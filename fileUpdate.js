const fs = require('fs');
const path = require('path');

const DEFAULT_CMS_TYPE = 'sitecore';
const DEFAULT_LOCAL_PATH = 'C:\\Sitecore\\ContentStack\\ContentMigration\\MigrationFW\\contentstack-migration-framework\\serialization';

const config = {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: DEFAULT_CMS_TYPE,
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },
  localPath: DEFAULT_LOCAL_PATH
};

const configFilePath = path.resolve(path?.join?.('upload-api', 'src', 'config', 'index.ts'));

const ensureDirectoryExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📂 Created missing directory:', dir);
  }
};

const validateConfiguredPath = (input) => {
  if (!input || !input.trim()) {
    throw new Error('The configured local path is empty.');
  }

  if (!fs.existsSync(input)) {
    throw new Error(`The configured local path does not exist: ${input}`);
  }
};

const XMLMigration = async () => {
  validateConfiguredPath(config.localPath);
  ensureDirectoryExists(configFilePath);
  fs.writeFileSync(configFilePath, `export default ${JSON.stringify(config, null, 2)};`, 'utf8');
  console.log(`Configured ${config.cmsType} using local path: ${config.localPath}`);
};

XMLMigration();
