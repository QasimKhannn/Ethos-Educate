import crypto from 'crypto';

const maxAppNameLength = 32;

const sanitize = (value) => {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'branch';
};

const refName = process.env.GITHUB_REF_NAME || process.env.BRANCH_NAME || 'local';
const stagingBranch = process.env.STAGING_BRANCH || 'codex/serverless-azure-deployment';
const stagingAppName = process.env.STAGING_APP_NAME || 'educhat-staging';
const prefix = sanitize(process.env.APP_NAME_PREFIX || 'educhat');

const getPreviewAppName = () => {
  const hash = crypto.createHash('sha1').update(refName).digest('hex').slice(0, 6);
  const suffix = `-${hash}`;
  const namePrefix = `${prefix}-`;
  const maxSlugLength = maxAppNameLength - namePrefix.length - suffix.length;
  const rawSlug = sanitize(refName);
  const slug = rawSlug.slice(0, Math.max(maxSlugLength, 1)).replace(/-+$/g, '') || 'branch';

  return `${namePrefix}${slug}${suffix}`;
};

const appName = refName === stagingBranch ? stagingAppName : getPreviewAppName();
const imageSafeBranch = sanitize(refName).slice(0, 40) || 'branch';
const shortSha = (process.env.GITHUB_SHA || 'local').slice(0, 12);
const imageTag = `${imageSafeBranch}-${shortSha}`;

const lines = [
  `app_name=${appName}`,
  `image_tag=${imageTag}`,
  `is_staging=${refName === stagingBranch ? 'true' : 'false'}`,
];

for (const line of lines) {
  console.log(line);
}
