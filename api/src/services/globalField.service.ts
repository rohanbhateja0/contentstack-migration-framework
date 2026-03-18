import { getLogMessage, safePromise } from "../utils/index.js";
import getAuthtoken from "../utils/auth.utils.js";
import { config } from "../config/index.js";
import https from "../utils/https.utils.js";
import fs from 'fs';
import { HTTP_TEXTS, MIGRATION_DATA_CONFIG} from "../constants/index.js";
import path from "path";
import logger from "../utils/logger.js";

const {
  GLOBAL_FIELDS_FILE_NAME,
  GLOBAL_FIELDS_DIR_NAME,

} = MIGRATION_DATA_CONFIG;

const readGeneratedGlobalFields = async (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const globalFieldSchema = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(globalFieldSchema);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Error parsing JSON in ${filePath}:`, error);
    return [];
  }
};

const fetchExistingGlobalFields = async ({
  region,
  stackId,
  authtoken,
}: {
  region: string;
  stackId: string;
  authtoken: string;
}) => {
  const [err, res] = await safePromise(
    https({
      method: "GET",
      url: `${config.CS_API[
        region as keyof typeof config.CS_API
      ]!}/global_fields?include_global_field_schema=true`,
      headers: {
        api_key: stackId,
        authtoken,
      },
    })
  );

  if (err) {
    throw err;
  }

  return Array.isArray(res?.data?.global_fields) ? res.data.global_fields : [];
};

const createMissingGlobalFields = async ({
  region,
  stackId,
  authtoken,
  generatedGlobalFields,
  existingGlobalFields,
}: {
  region: string;
  stackId: string;
  authtoken: string;
  generatedGlobalFields: any[];
  existingGlobalFields: any[];
}) => {
  const existingUids = new Set(existingGlobalFields.map((field: any) => field?.uid).filter(Boolean));

  for (const globalField of generatedGlobalFields) {
    if (!globalField?.uid || existingUids.has(globalField.uid)) {
      continue;
    }

    const payload = {
      global_field: {
        title: globalField.title,
        uid: globalField.uid,
        schema: globalField.schema ?? [],
      },
    };

    const [createErr] = await safePromise(
      https({
        method: "POST",
        url: `${config.CS_API[
          region as keyof typeof config.CS_API
        ]!}/global_fields`,
        headers: {
          api_key: stackId,
          authtoken,
          'Content-Type': 'application/json',
        },
        data: payload,
      })
    );

    if (createErr) {
      throw createErr;
    }

    existingUids.add(globalField.uid);
  }
};

const createGlobalField = async ({
  region,
  user_id,
  stackId,
  current_test_stack_id
}: {
  region: string;
  user_id: string;
  stackId: string;
  current_test_stack_id?: string;
}) => {
  const srcFun = "createGlobalField"; 
  const authtoken = await getAuthtoken(region, user_id); 
  try {
    const globalSave = path.join(MIGRATION_DATA_CONFIG.DATA, current_test_stack_id ?? '', GLOBAL_FIELDS_DIR_NAME);
    if(!fs.existsSync(globalSave)) {
      fs.mkdirSync(globalSave, { recursive: true });
    }
    const filePath = path.join(process.cwd(),globalSave, GLOBAL_FIELDS_FILE_NAME);
    const fileGlobalFields = await readGeneratedGlobalFields(filePath);
    const existingGlobalFields = await fetchExistingGlobalFields({
      region,
      stackId,
      authtoken,
    });

    await createMissingGlobalFields({
      region,
      stackId,
      authtoken,
      generatedGlobalFields: fileGlobalFields,
      existingGlobalFields,
    });

    const refreshedGlobalFields = await fetchExistingGlobalFields({
      region,
      stackId,
      authtoken,
    });
    
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(refreshedGlobalFields, null, 2));
   
  } catch (error: any) {
    logger.error(
      getLogMessage(srcFun, HTTP_TEXTS.CS_ERROR, {}, error)
    );
    return {
      data: error,
      status: error?.response?.status || 500,
    };
    
  }
 }


export const globalFieldServie = {
  createGlobalField
}