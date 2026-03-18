/*
sitecore Validator
 */
const {
  isSitecoreSerializationFolder,
} = require('../../services/sitecoreSerialization');

interface items {
  files: { [key: string]: any };
}

interface props {
  data: items | string;
}

async function sitecoreValidator({ data }: props) {
  try {
    if (typeof data === 'string') {
      return isSitecoreSerializationFolder(data);
    }

    const sitecoreFolders = ['installer', 'items', 'metadata', 'properties'];
    const foundFolders = new Set<string>();
    let hasNestedZip = false;
    const nestedZipFiles: string[] = [];

    for (const filename of Object.keys(data?.files)) {
      // Check for nested zip files
      if (filename.toLowerCase().endsWith('.zip')) {
        hasNestedZip = true;
        nestedZipFiles.push(filename);
        continue;
      }

      // Check for required Sitecore folders
      for (const folder of sitecoreFolders) {
        if (filename.includes(`/${folder}/`) || filename.startsWith(`${folder}/`)) {
          foundFolders.add(folder);
          break;
        }
      }
    }

    // If we have nested zip files, we need to extract and check them
    if (hasNestedZip) {
      const JSZip = require('jszip');

      for (const nestedZipPath of nestedZipFiles) {
        const nestedZipFile = data.files[nestedZipPath];
        if (nestedZipFile && !nestedZipFile.dir) {
          try {
            const nestedZipBuffer = await nestedZipFile.async('nodebuffer');
            const nestedZip = new JSZip();
            await nestedZip.loadAsync(nestedZipBuffer);

            // Check nested zip for Sitecore folders
            for (const nestedFilename of Object.keys(nestedZip.files)) {
              for (const folder of sitecoreFolders) {
                if (
                  nestedFilename.includes(`/${folder}/`) ||
                  nestedFilename.startsWith(`${folder}/`)
                ) {
                  foundFolders.add(folder);
                  break;
                }
              }
            }
          } catch (nestedErr: any) {
            console.warn(
              '🚀 ~ sitecoreValidator ~ Error processing nested zip:',
              nestedZipPath,
              nestedErr.message
            );
          }
        }
      }
    }
    // Check if we have the minimum required folders (at least items and metadata)
    const requiredMinimum = ['items', 'metadata'];
    const hasMinimumRequired = requiredMinimum.every((folder) => foundFolders.has(folder));

    if (hasMinimumRequired) {
      return true;
    }
    return false;
  } catch (err) {
    console.info('🚀 ~ sitecoreValidator ~ err:', err);
    return false;
  }
}

export default sitecoreValidator;
