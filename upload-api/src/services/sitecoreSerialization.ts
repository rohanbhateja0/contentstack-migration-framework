import fs from 'fs';
import path from 'path';

const yaml = require('js-yaml');

const TEMPLATE_ITEM_ID = 'ab86861a-6030-46c5-b394-e8f99e8b87db';
const TEMPLATE_SECTION_ID = 'e269fbb5-3750-427a-9149-7aa950b49301';
const TEMPLATE_FIELD_ID = '455a3e98-a627-4b40-8035-e683a0331ac7';

type SharedField = {
  Hint?: string;
  Value?: string;
};

type LanguageField = {
  Hint?: string;
  Value?: string;
};

type LanguageEntry = {
  Language?: string;
  Fields?: LanguageField[];
};

type SerializedItem = {
  ID?: string;
  Parent?: string;
  Template?: string;
  Path?: string;
  SharedFields?: SharedField[];
  Languages?: LanguageEntry[];
};

type TemplateFieldDefinition = {
  id: string;
  name: string;
  title: string;
  key: string;
  type: string;
  source: string;
  sortOrder: number;
};

type TemplateSectionDefinition = {
  id: string;
  name: string;
  title: string;
  key: string;
  sortOrder: number;
  fields: TemplateFieldDefinition[];
};

type TemplateDefinition = {
  id: string;
  name: string;
  title: string;
  key: string;
  path: string;
  sortOrder: number;
  baseTemplateIds: string[];
  sections: TemplateSectionDefinition[];
};

type MapperField = {
  id: string;
  uid: string;
  otherCmsField: string;
  otherCmsType: string;
  contentstackField: string;
  contentstackFieldUid: string;
  contentstackFieldType: string;
  backupFieldType: string;
  backupFieldUid: string;
  isDeleted?: boolean;
  refrenceTo?: string | string[];
  initialRefrenceTo?: string | string[];
  advanced?: Record<string, unknown>;
  sourceKey?: string;
};

type MapperContentType = {
  id: string;
  status: number;
  otherCmsTitle: string;
  otherCmsUid: string;
  isUpdated: boolean;
  updateAt: string;
  contentstackTitle: string;
  contentstackUid: string;
  fieldMapping: MapperField[];
  type: 'content_type' | 'global_field';
  globalFieldSource?: boolean;
};

type TemplateSyncReport = {
  templateTitle: string;
  templateUid: string;
  expectedGroupCount: number;
  expectedFieldCount: number;
  actualGroupCount: number;
  actualFieldCount: number;
  matches: boolean;
  sectionBreakdown: Array<{
    sectionKey: string;
    expectedFieldCount: number;
    actualFieldCount: number;
  }>;
};

const FIELD_TYPE_MAP: Record<string, { type: string; advanced?: Record<string, unknown> }> = {
  'single-line text': { type: 'single_line_text' },
  text: { type: 'single_line_text' },
  'multi-line text': { type: 'multi_line_text' },
  'rich text': { type: 'json' },
  checkbox: { type: 'boolean' },
  date: { type: 'isodate' },
  time: { type: 'isodate' },
  datetime: { type: 'isodate' },
  'date time': { type: 'isodate' },
  integer: { type: 'number' },
  number: { type: 'number' },
  droplist: { type: 'dropdown', advanced: { options: [], Multiple: false } },
  'grouped droplist': { type: 'dropdown', advanced: { options: [], Multiple: false } },
  'general link': { type: 'link' },
  'internal link': { type: 'link' },
  'general link with search': { type: 'link' },
  image: { type: 'file' },
  file: { type: 'file' },
  'image or file': { type: 'file' },
  'cloudflare advanced image': { type: 'file' },
  'droplink': { type: 'reference' },
  'droptree': { type: 'reference' },
  'treelist': { type: 'reference' },
  'treelistex': { type: 'reference' },
  'treelistex with multiple roots': { type: 'reference' },
  'multiroot treelist': { type: 'reference' },
  'checklist': { type: 'reference' },
  'multilist': { type: 'reference' },
  'multilist with search': { type: 'reference' },
};

function readDirectoryRecursively(dirPath: string, results: string[] = []): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      readDirectoryRecursively(absolutePath, results);
    } else {
      results.push(absolutePath);
    }
  }
  return results;
}

function normalizeGuid(value?: string): string {
  return (value ?? '').replace(/[{}]/g, '').toLowerCase();
}

function getLastPathSegment(value?: string): string {
  if (!value) {
    return '';
  }

  const parts = value.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function normalizeFieldValue(value?: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function getSharedFieldValue(item: SerializedItem, hint: string): string {
  const field = item.SharedFields?.find(
    (entry) => entry?.Hint?.toLowerCase() === hint.toLowerCase()
  );
  return normalizeFieldValue(field?.Value);
}

function getLanguageFieldValue(item: SerializedItem, hint: string): string {
  for (const language of item.Languages ?? []) {
    const field = language.Fields?.find(
      (entry) => entry?.Hint?.toLowerCase() === hint.toLowerCase()
    );
    const normalizedValue = normalizeFieldValue(field?.Value);
    if (normalizedValue) {
      return normalizedValue;
    }
  }
  return '';
}

function getItemTitle(item: SerializedItem): string {
  return (
    getLanguageFieldValue(item, 'Title') ||
    getLanguageFieldValue(item, '__Display name') ||
    getLastPathSegment(item.Path)
  );
}

function getItemKey(item: SerializedItem): string {
  return getLastPathSegment(item.Path);
}

function uidCorrector(uid: string): string {
  let newUid = uid
    .replace(/[ -]/g, '_')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`)
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (newUid.startsWith('_')) {
    newUid = newUid.substring(1);
  }

  return newUid;
}

function startsWithNumber(value: string): boolean {
  return /^\d/.test(value);
}

function applyAffixIfNeeded(uid: string, affix: string): string {
  const corrected = uidCorrector(uid);
  if (startsWithNumber(corrected)) {
    return `${affix}_${corrected}`;
  }
  return corrected;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function mergeFieldsByKey(fields: TemplateFieldDefinition[]): TemplateFieldDefinition[] {
  const fieldMap = new Map<string, TemplateFieldDefinition>();

  for (const field of fields) {
    const mergeKey = uidCorrector(field.key || field.name || field.id);
    const existingField = fieldMap.get(mergeKey);

    if (!existingField) {
      fieldMap.set(mergeKey, field);
      continue;
    }

    fieldMap.set(mergeKey, {
      ...existingField,
      ...field,
      title: field.title || existingField.title,
      type: field.type || existingField.type,
      source: field.source || existingField.source,
      sortOrder: Math.min(existingField.sortOrder, field.sortOrder),
    });
  }

  return [...fieldMap.values()].sort((left, right) => left.sortOrder - right.sortOrder);
}

function mergeSectionsByKey(sections: TemplateSectionDefinition[]): TemplateSectionDefinition[] {
  const sectionMap = new Map<string, TemplateSectionDefinition>();

  for (const section of sections) {
    const mergeKey = uidCorrector(section.key || section.name || section.id);
    const existingSection = sectionMap.get(mergeKey);

    if (!existingSection) {
      sectionMap.set(mergeKey, {
        ...section,
        fields: mergeFieldsByKey(section.fields),
      });
      continue;
    }

    sectionMap.set(mergeKey, {
      ...existingSection,
      ...section,
      title: section.title || existingSection.title,
      key: existingSection.key || section.key,
      name: existingSection.name || section.name,
      sortOrder: Math.min(existingSection.sortOrder, section.sortOrder),
      fields: mergeFieldsByKey([...existingSection.fields, ...section.fields]),
    });
  }

  return [...sectionMap.values()].sort((left, right) => left.sortOrder - right.sortOrder);
}

function buildTemplateDefinitions(items: SerializedItem[]): TemplateDefinition[] {
  const templates = items.filter(
    (item) => normalizeGuid(item.Template) === TEMPLATE_ITEM_ID
  );
  const sections = items.filter(
    (item) => normalizeGuid(item.Template) === TEMPLATE_SECTION_ID
  );
  const fields = items.filter(
    (item) => normalizeGuid(item.Template) === TEMPLATE_FIELD_ID
  );

  const sectionsByParent = new Map<string, TemplateSectionDefinition[]>();
  const fieldsByParent = new Map<string, TemplateFieldDefinition[]>();

  for (const field of fields) {
    const definition: TemplateFieldDefinition = {
      id: normalizeGuid(field.ID),
      name: getLastPathSegment(field.Path),
      title: getItemTitle(field),
      key: getItemKey(field),
      type: getSharedFieldValue(field, 'Type'),
      source: getSharedFieldValue(field, 'Source'),
      sortOrder: Number(getSharedFieldValue(field, '__Sortorder') || 0),
    };
    const parentId = normalizeGuid(field.Parent);
    const current = fieldsByParent.get(parentId) ?? [];
    current.push(definition);
    fieldsByParent.set(parentId, current);
  }

  for (const section of sections) {
    const definition: TemplateSectionDefinition = {
      id: normalizeGuid(section.ID),
      name: getLastPathSegment(section.Path),
      title: getItemTitle(section),
      key: getItemKey(section),
      sortOrder: Number(getSharedFieldValue(section, '__Sortorder') || 0),
      fields: (fieldsByParent.get(normalizeGuid(section.ID)) ?? []).sort(
        (left, right) => left.sortOrder - right.sortOrder
      ),
    };
    const parentId = normalizeGuid(section.Parent);
    const current = sectionsByParent.get(parentId) ?? [];
    current.push(definition);
    sectionsByParent.set(parentId, current);
  }

  return templates
    .map((template) => ({
      id: normalizeGuid(template.ID),
      name: getLastPathSegment(template.Path),
      title: getItemTitle(template),
      key: getItemKey(template),
      path: template.Path ?? '',
      sortOrder: Number(getSharedFieldValue(template, '__Sortorder') || 0),
      baseTemplateIds: getSharedFieldValue(template, '__Base template')
        .split(/\r?\n/)
        .map((value) => normalizeGuid(value.trim()))
        .filter(Boolean),
      sections: (sectionsByParent.get(normalizeGuid(template.ID)) ?? []).sort(
        (left, right) => left.sortOrder - right.sortOrder
      ),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function flattenSectionsWithInheritance(
  template: TemplateDefinition,
  templateMap: Map<string, TemplateDefinition>,
  visited = new Set<string>()
): TemplateSectionDefinition[] {
  if (visited.has(template.id)) {
    return [];
  }

  visited.add(template.id);

  const inherited: TemplateSectionDefinition[] = [];
  for (const baseTemplateId of template.baseTemplateIds) {
    const baseTemplate = templateMap.get(baseTemplateId);
    if (!baseTemplate) {
      continue;
    }
    inherited.push(...flattenSectionsWithInheritance(baseTemplate, templateMap, visited));
  }

  const combined = [...inherited, ...template.sections];
  const uniqueSections = mergeSectionsByKey(combined);

  return uniqueSections.sort((left, right) => left.sortOrder - right.sortOrder);
}

function mapSitecoreField(
  field: TemplateFieldDefinition,
  groupUid: string,
  _templates: TemplateDefinition[],
  _templateMap: Map<string, TemplateDefinition>,
  _targetIndex: Map<string, Set<string>>,
  _affix: string
): MapperField {
  const normalizedFieldType = field.type.toLowerCase();
  const mappedField = FIELD_TYPE_MAP[normalizedFieldType] ?? { type: 'single_line_text' };
  const fieldUid = uidCorrector(field.key);

  const mapperField: MapperField = {
    id: field.id,
    uid: `${groupUid}.${field.key}`,
    otherCmsField: `${groupUid} > ${field.title}`,
    otherCmsType: field.type || 'Unknown',
    contentstackField: `${groupUid} > ${field.title}`,
    contentstackFieldUid: `${groupUid}.${fieldUid}`,
    contentstackFieldType: mappedField.type,
    backupFieldType: mappedField.type,
    backupFieldUid: `${groupUid}.${fieldUid}`,
    isDeleted: false,
  };

  if (mappedField.advanced) {
    mapperField.advanced = { ...mappedField.advanced };
  }

  if (mappedField.type === 'reference' && field.source) {
    mapperField.sourceKey = field.source;
  }

  return mapperField;
}

function createMapperContentType(
  template: TemplateDefinition,
  templates: TemplateDefinition[],
  templateMap: Map<string, TemplateDefinition>,
  targetIndex: Map<string, Set<string>>,
  affix: string,
  options: {
    type: 'content_type' | 'global_field';
    includeInheritedSections: boolean;
    includeBaseTemplateReferences: boolean;
  }
): MapperContentType {
  const contentstackUid = applyAffixIfNeeded(template.key, affix);
  const sections = options.includeInheritedSections
    ? flattenSectionsWithInheritance(template, templateMap)
    : template.sections;
  const fieldMapping: MapperField[] = [];

  fieldMapping.push({
    id: 'title',
    uid: 'title',
    otherCmsField: 'title',
    otherCmsType: 'text',
    contentstackField: 'Title',
    contentstackFieldUid: 'title',
    contentstackFieldType: 'text',
    backupFieldType: 'text',
    backupFieldUid: 'title',
    isDeleted: false,
  });

  fieldMapping.push({
    id: 'url',
    uid: 'url',
    otherCmsField: 'url',
    otherCmsType: 'text',
    contentstackField: 'Url',
    contentstackFieldUid: 'url',
    contentstackFieldType: 'url',
    backupFieldType: 'url',
    backupFieldUid: 'url',
    isDeleted: false,
  });

  if (options.includeBaseTemplateReferences) {
    for (const baseTemplateId of template.baseTemplateIds) {
      const baseTemplate = templateMap.get(baseTemplateId);
      if (!baseTemplate) {
        continue;
      }

      const baseUid = applyAffixIfNeeded(baseTemplate.key, affix);
      fieldMapping.push({
        id: baseTemplate.id,
        uid: baseTemplate.key,
        otherCmsField: baseTemplate.key,
        otherCmsType: 'base template',
        contentstackField: baseTemplate.key,
        contentstackFieldUid: baseUid,
        contentstackFieldType: 'global_field',
        backupFieldType: 'global_field',
        backupFieldUid: baseUid,
        refrenceTo: baseUid,
        initialRefrenceTo: baseUid,
        isDeleted: false,
      });
    }
  }

  for (const section of sections) {
    const groupUid = applyAffixIfNeeded(section.key, affix);
    fieldMapping.push({
      id: section.id,
      uid: section.key,
      otherCmsField: section.title,
      otherCmsType: 'Group',
      contentstackField: section.title,
      contentstackFieldUid: groupUid,
      contentstackFieldType: 'group',
      backupFieldType: 'group',
      backupFieldUid: groupUid,
      isDeleted: false,
    });

    for (const field of section.fields) {
      fieldMapping.push(
        mapSitecoreField(field, groupUid, templates, templateMap, targetIndex, affix)
      );
    }
  }

  return {
    id: template.id,
    status: 1,
    otherCmsTitle: template.title,
    otherCmsUid: template.key,
    isUpdated: false,
    updateAt: '',
    contentstackTitle: template.title,
    contentstackUid,
    fieldMapping,
    type: options.type,
  };
}

function loadSerializedItems(folderPath: string): SerializedItem[] {
  const allFiles = readDirectoryRecursively(folderPath);
  const yamlFiles = allFiles.filter((filePath) => filePath.toLowerCase().endsWith('.yml'));

  return yamlFiles
    .map((filePath) => {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const parsed = yaml.load(fileContents) as SerializedItem | undefined;
      return parsed;
    })
    .filter((item): item is SerializedItem => Boolean(item?.ID && item?.Path));
}

export function isSitecoreSerializationFolder(folderPath: string): boolean {
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return false;
  }

  const sampleFiles = readDirectoryRecursively(folderPath)
    .filter((filePath) => filePath.toLowerCase().endsWith('.yml'))
    .slice(0, 25);

  if (!sampleFiles.length) {
    return false;
  }

  return sampleFiles.some((filePath) => {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return fileContents.includes('Path: /sitecore/templates/');
  });
}

export function extractSerializationLocales(folderPath: string): string[] {
  const items = loadSerializedItems(folderPath);
  const locales = new Set<string>();

  for (const item of items) {
    for (const language of item.Languages ?? []) {
      if (language.Language) {
        locales.add(language.Language);
      }
    }
  }

  return [...locales];
}

export function createSitecoreSerializationMapper(folderPath: string, affix: string) {
  const items = loadSerializedItems(folderPath);
  const templates = buildTemplateDefinitions(items);
  const templateMap = new Map<string, TemplateDefinition>(
    templates.map((template) => [template.id, template])
  );
  const referenceTargetIndex = new Map<string, Set<string>>();

  const inheritedTemplateIds = new Set<string>();
  for (const template of templates) {
    for (const baseTemplateId of template.baseTemplateIds) {
      inheritedTemplateIds.add(baseTemplateId);
    }
  }

  const contentTypes: Array<MapperContentType & { globalFieldSource: boolean }> = templates.map((template) =>
    ({
      ...createMapperContentType(template, templates, templateMap, referenceTargetIndex, affix, {
      type: 'content_type',
      includeInheritedSections: false,
      includeBaseTemplateReferences: template.baseTemplateIds.length > 0,
      }),
      globalFieldSource: inheritedTemplateIds.has(template.id),
    })
  );

  return {
    extractPath: folderPath,
    contentTypes,
  };
}

export function createSitecoreSerializationSyncReport(
  folderPath: string,
  affix: string,
  templateUid?: string
): TemplateSyncReport[] {
  const items = loadSerializedItems(folderPath);
  const templates = buildTemplateDefinitions(items);
  const templateMap = new Map<string, TemplateDefinition>(
    templates.map((template) => [template.id, template])
  );
  const referenceTargetIndex = new Map<string, Set<string>>();

  const contentTypes = templates.map((template) =>
    createMapperContentType(template, templates, templateMap, referenceTargetIndex, affix, {
      type: 'content_type',
      includeInheritedSections: true,
      includeBaseTemplateReferences: false,
    })
  );

  const reports = templates.map((template) => {
    const sections = flattenSectionsWithInheritance(template, templateMap);
    const mapperContentType = contentTypes.find(
      (contentType) => contentType.id === template.id
    );

    const actualGroups = mapperContentType?.fieldMapping.filter(
      (field) => field.contentstackFieldType === 'group'
    ) ?? [];
    const actualLeafFields = mapperContentType?.fieldMapping.filter(
      (field) =>
        field.contentstackFieldUid !== 'title' &&
        field.contentstackFieldUid !== 'url' &&
        field.contentstackFieldType !== 'group'
    ) ?? [];

    const sectionBreakdown = sections.map((section) => {
      const sectionUid = applyAffixIfNeeded(section.key, affix);
      const actualFieldCount = mapperContentType?.fieldMapping.filter((field) =>
        field.contentstackFieldUid.startsWith(`${sectionUid}.`)
      ).length ?? 0;

      return {
        sectionKey: sectionUid,
        expectedFieldCount: section.fields.length,
        actualFieldCount,
      };
    });

    const expectedFieldCount = sections.reduce(
      (total, section) => total + section.fields.length,
      0
    );

    return {
      templateTitle: template.title,
      templateUid: applyAffixIfNeeded(template.key, affix),
      expectedGroupCount: sections.length,
      expectedFieldCount,
      actualGroupCount: actualGroups.length,
      actualFieldCount: actualLeafFields.length,
      matches:
        sections.length === actualGroups.length &&
        expectedFieldCount === actualLeafFields.length,
      sectionBreakdown,
    };
  });

  if (!templateUid) {
    return reports;
  }

  return reports.filter((report) => report.templateUid === templateUid);
}