import { logger } from '@librechat/data-schemas';
import { FileSources } from 'librechat-data-provider';
import { DefaultAzureCredential } from '@azure/identity';
import {
  SASProtocol,
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import type { ContainerClient, UserDelegationKey } from '@azure/storage-blob';

type AzureBlobReference = {
  containerName: string;
  blobName: string;
};

let blobServiceClient: BlobServiceClient | null = null;
let sharedKeyCredential: StorageSharedKeyCredential | null = null;
let azureWarningLogged = false;
let azureUrlExpirySeconds = 2 * 60;
let userDelegationKeyCache: { key: UserDelegationKey; expiresOn: Date } | null = null;

if (process.env.AZURE_BLOB_URL_EXPIRY_SECONDS !== undefined) {
  const parsed = parseInt(process.env.AZURE_BLOB_URL_EXPIRY_SECONDS, 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    azureUrlExpirySeconds = Math.min(parsed, 7 * 24 * 60 * 60);
  } else {
    logger.warn(
      `[AzureBlob] Invalid AZURE_BLOB_URL_EXPIRY_SECONDS value: "${process.env.AZURE_BLOB_URL_EXPIRY_SECONDS}". Using 2-minute expiry.`,
    );
  }
}

const getConnectionStringPart = (partName: string): string | undefined => {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    return undefined;
  }

  return connectionString.split(';').reduce<string | undefined>((match, part) => {
    if (match) {
      return match;
    }
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      return undefined;
    }
    const key = part.slice(0, separatorIndex);
    return key === partName ? part.slice(separatorIndex + 1) : undefined;
  }, undefined);
};

const getAzureStorageAccountName = (): string | undefined =>
  process.env.AZURE_STORAGE_ACCOUNT_NAME ?? getConnectionStringPart('AccountName');

const getSharedKeyCredential = (): StorageSharedKeyCredential | null => {
  if (sharedKeyCredential) {
    return sharedKeyCredential;
  }

  const accountName = getAzureStorageAccountName();
  const accountKey = getConnectionStringPart('AccountKey');
  if (!accountName || !accountKey) {
    return null;
  }

  sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  return sharedKeyCredential;
};

const isPublicAccessEnabled = (): boolean =>
  process.env.AZURE_STORAGE_PUBLIC_ACCESS?.toLowerCase() === 'true';

/**
 * Initializes the Azure Blob Service client.
 * This function establishes a connection by checking if a connection string is provided.
 * If available, the connection string is used; otherwise, Managed Identity (via DefaultAzureCredential) is utilized.
 * Note: Container creation (and its public access settings) is handled later in the CRUD functions.
 * @returns The initialized client, or null if the required configuration is missing.
 */
export const initializeAzureBlobService = async (): Promise<BlobServiceClient | null> => {
  if (blobServiceClient) {
    return blobServiceClient;
  }
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    logger.info('Azure Blob Service initialized using connection string');
  } else {
    const accountName = getAzureStorageAccountName();
    if (!accountName) {
      if (!azureWarningLogged) {
        logger.error(
          '[initializeAzureBlobService] Azure Blob Service not initialized. Connection string missing and AZURE_STORAGE_ACCOUNT_NAME not provided.',
        );
        azureWarningLogged = true;
      }
      return null;
    }
    const url = `https://${accountName}.blob.core.windows.net`;
    const credential = new DefaultAzureCredential();
    blobServiceClient = new BlobServiceClient(url, credential);
    logger.info('Azure Blob Service initialized using Managed Identity');
  }
  return blobServiceClient;
};

/**
 * Retrieves the Azure ContainerClient for the given container name.
 * @param [containerName=process.env.AZURE_CONTAINER_NAME || 'files'] - The container name.
 * @returns The Azure ContainerClient.
 */
export const getAzureContainerClient = async (
  containerName = process.env.AZURE_CONTAINER_NAME || 'files',
): Promise<ContainerClient | null> => {
  const serviceClient = await initializeAzureBlobService();
  return serviceClient ? serviceClient.getContainerClient(containerName) : null;
};

export const getAzureBlobName = (
  fileUrlOrPath: string,
  containerName = process.env.AZURE_CONTAINER_NAME || 'files',
): string => {
  if (!fileUrlOrPath?.trim()) {
    throw new Error('Invalid Azure Blob path: value is empty');
  }

  try {
    const url = new URL(fileUrlOrPath);
    const pathSegments = decodeURIComponent(url.pathname).replace(/^\/+/, '').split('/');
    if (pathSegments[0] === containerName) {
      return pathSegments.slice(1).join('/');
    }
    return pathSegments.join('/');
  } catch {
    const cleanedPath = fileUrlOrPath.replace(/^\/+/, '');
    return cleanedPath.startsWith(`${containerName}/`)
      ? cleanedPath.slice(containerName.length + 1)
      : cleanedPath;
  }
};

const getAzureBlobReference = (
  fileUrlOrPath: string,
  containerName = process.env.AZURE_CONTAINER_NAME || 'files',
): AzureBlobReference => ({
  containerName,
  blobName: getAzureBlobName(fileUrlOrPath, containerName),
});

const getUserDelegationKey = async (
  serviceClient: BlobServiceClient,
  startsOn: Date,
  expiresOn: Date,
): Promise<UserDelegationKey> => {
  if (userDelegationKeyCache?.expiresOn.getTime() > Date.now() + 60 * 1000) {
    return userDelegationKeyCache.key;
  }

  try {
    const key = await serviceClient.getUserDelegationKey(startsOn, expiresOn);
    userDelegationKeyCache = { key, expiresOn };
    return key;
  } catch (error) {
    logger.error('[AzureBlob] Failed to create user delegation key:', error);
    throw error;
  }
};

export const getAzureBlobReadUrl = async ({
  blobName,
  containerName = process.env.AZURE_CONTAINER_NAME || 'files',
}: AzureBlobReference): Promise<string> => {
  const containerClient = await getAzureContainerClient(containerName);
  if (!containerClient) {
    throw new Error('Azure Blob Storage is not configured');
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  if (isPublicAccessEnabled()) {
    return blockBlobClient.url;
  }

  const now = new Date();
  const startsOn = new Date(now.getTime() - 5 * 60 * 1000);
  const expiresOn = new Date(now.getTime() + azureUrlExpirySeconds * 1000);
  const sharedKey = getSharedKeyCredential();
  const sasOptions = {
    blobName,
    startsOn,
    expiresOn,
    containerName,
    protocol: SASProtocol.Https,
    permissions: BlobSASPermissions.parse('r'),
  };

  if (sharedKey) {
    const sas = generateBlobSASQueryParameters(sasOptions, sharedKey).toString();
    return `${blockBlobClient.url}?${sas}`;
  }

  const accountName = getAzureStorageAccountName();
  const serviceClient = await initializeAzureBlobService();
  if (!accountName || !serviceClient) {
    throw new Error('Azure Blob Storage account name is required to generate private blob URLs');
  }

  const userDelegationKey = await getUserDelegationKey(serviceClient, startsOn, expiresOn);
  const sas = generateBlobSASQueryParameters(sasOptions, userDelegationKey, accountName).toString();
  return `${blockBlobClient.url}?${sas}`;
};

export const getAzureBlobReadUrlFromPath = async (
  fileUrlOrPath: string,
  containerName = process.env.AZURE_CONTAINER_NAME || 'files',
): Promise<string> => getAzureBlobReadUrl(getAzureBlobReference(fileUrlOrPath, containerName));

export const getAzureBlobDownloadStream = async (
  fileUrlOrPath: string,
  containerName = process.env.AZURE_CONTAINER_NAME || 'files',
): Promise<NodeJS.ReadableStream> => {
  const { blobName } = getAzureBlobReference(fileUrlOrPath, containerName);
  const containerClient = await getAzureContainerClient(containerName);
  if (!containerClient) {
    throw new Error('Azure Blob Storage is not configured');
  }

  const response = await containerClient.getBlockBlobClient(blobName).download();
  if (!response.readableStreamBody) {
    throw new Error(`Azure Blob download stream is unavailable for ${blobName}`);
  }

  return response.readableStreamBody;
};

export const isAzureBlobUrlExpired = (signedUrl: string, bufferSeconds = 3600): boolean => {
  try {
    const url = new URL(signedUrl);
    if (!url.searchParams.has('sig')) {
      return false;
    }

    const expiresOn = url.searchParams.get('se');
    if (!expiresOn) {
      return true;
    }

    const expiryTime = new Date(expiresOn).getTime();
    return Number.isNaN(expiryTime) ? true : expiryTime <= Date.now() + bufferSeconds * 1000;
  } catch {
    return false;
  }
};

export type AzureRefreshableFile = {
  file_id?: string;
  filepath?: string;
  source?: FileSources;
};

export type BatchUpdateAzureFiles = (
  files: Array<{ file_id: string; filepath: string }>,
) => Promise<void>;

export const refreshAzureBlobUrl = async (
  fileObj?: AzureRefreshableFile | null,
  bufferSeconds = 3600,
): Promise<string | undefined> => {
  if (!fileObj?.filepath || fileObj.source !== FileSources.azure_blob) {
    return fileObj?.filepath;
  }

  if (!isAzureBlobUrlExpired(fileObj.filepath, bufferSeconds)) {
    return fileObj.filepath;
  }

  return getAzureBlobReadUrlFromPath(fileObj.filepath);
};

export const refreshAzureBlobUrls = async (
  files: AzureRefreshableFile[],
  batchUpdateFiles: BatchUpdateAzureFiles,
  bufferSeconds = 3600,
): Promise<AzureRefreshableFile[]> => {
  if (!files?.length) {
    return files;
  }

  const filesToUpdate: Array<{ file_id: string; filepath: string }> = [];
  await Promise.all(
    files.map(async (file) => {
      if (!file.file_id || file.source !== FileSources.azure_blob || !file.filepath) {
        return;
      }

      try {
        const filepath = await refreshAzureBlobUrl(file, bufferSeconds);
        if (!filepath || filepath === file.filepath) {
          return;
        }

        filesToUpdate.push({ file_id: file.file_id, filepath });
        file.filepath = filepath;
      } catch (error) {
        logger.error(`Error refreshing Azure Blob URL for file ${file.file_id}:`, error);
      }
    }),
  );

  if (filesToUpdate.length > 0) {
    await batchUpdateFiles(filesToUpdate);
  }

  return files;
};
