targetScope = 'resourceGroup'

@description('Container App name. Use lowercase letters, numbers, and hyphens.')
param appName string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Container image to run, for example myregistry.azurecr.io/csusa-librechat:latest.')
param image string

@description('Existing Azure Container Registry name used to pull the app image.')
param containerRegistryName string = ''

@description('Existing Azure Container Registry login server, for example myregistry.azurecr.io.')
param containerRegistryServer string = ''

@description('Container port exposed by the Node server.')
param containerPort int = 3080

@description('Minimum Container Apps replicas. Set to 0 only after confirming cold starts are acceptable.')
@minValue(0)
param minReplicas int = 1

@description('Maximum Container Apps replicas.')
@minValue(1)
param maxReplicas int = 3

@description('CPU cores for the app container, expressed as a JSON number string accepted by Container Apps.')
param cpuCores string = '1.0'

@description('Memory for the app container.')
param memorySize string = '2Gi'

@description('Blob container used by the azure_blob file strategy.')
param storageContainerName string = 'files'

@description('Additional private blob containers to create in the same storage account.')
param additionalStorageContainerNames array = []

@description('Plain environment variables for the app container.')
param plainEnv object = {}

@secure()
@description('Secret environment variables for the app container.')
param secretEnv object = {}

var storageNameBase = toLower(replace(replace(appName, '-', ''), '_', ''))
var storageAccountName = take('${storageNameBase}${uniqueString(resourceGroup().id)}', 24)
var logAnalyticsName = '${appName}-logs'
var managedEnvironmentName = '${appName}-env'
var identityName = '${appName}-identity'
var storageBlobDataContributorRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
)
var acrPullRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)
var baseEnv = {
  NODE_ENV: 'production'
  HOST: '0.0.0.0'
  PORT: string(containerPort)
  TRUST_PROXY: '1'
  CONSOLE_JSON: 'true'
  LIBRECHAT_LOG_DIR: '/tmp/librechat-logs'
  AZURE_STORAGE_ACCOUNT_NAME: storageAccountName
  AZURE_CONTAINER_NAME: storageContainerName
  AZURE_STORAGE_PUBLIC_ACCESS: 'false'
}
var containerSecrets = [
  for secret in items(secretEnv): {
    name: replace(toLower(secret.key), '_', '-')
    #disable-next-line use-secure-value-for-secure-inputs
    value: string(secret.value)
  }
]
var plainEnvVars = [
  for envVar in items(union(baseEnv, plainEnv)): {
    name: envVar.key
    value: string(envVar.value)
  }
]
var secretEnvVars = [
  for secret in items(secretEnv): {
    name: secret.key
    secretRef: replace(toLower(secret.key), '_', '-')
  }
]
var registries = empty(containerRegistryServer)
  ? []
  : [
      {
        server: containerRegistryServer
        identity: managedIdentity.id
      }
    ]

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = if (!empty(containerRegistryName)) {
  name: containerRegistryName
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: storageContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource additionalBlobContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [
  for containerName in additionalStorageContainerNames: {
    parent: blobService
    name: containerName
    properties: {
      publicAccess: 'None'
    }
  }
]

resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, managedIdentity.id, storageBlobDataContributorRoleId)
  scope: storage
  properties: {
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: storageBlobDataContributorRoleId
  }
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(containerRegistryName)) {
  name: guid(containerRegistry.id, managedIdentity.id, acrPullRoleId)
  scope: containerRegistry
  properties: {
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleId
  }
}

resource containerEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: managedEnvironmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: containerPort
        transport: 'http'
        allowInsecure: false
          }
          secrets: containerSecrets
          registries: registries
        }
    template: {
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '25'
              }
            }
          }
        ]
      }
      containers: [
        {
          name: 'api'
          image: image
          resources: {
            cpu: json(cpuCores)
            memory: memorySize
          }
          env: concat(plainEnvVars, secretEnvVars)
        }
      ]
    }
  }
  dependsOn: [
    blobContainer
    storageRoleAssignment
    acrPullRoleAssignment
  ]
}

output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output managedIdentityResourceId string = managedIdentity.id
output storageAccount string = storage.name
output blobContainerName string = blobContainer.name
