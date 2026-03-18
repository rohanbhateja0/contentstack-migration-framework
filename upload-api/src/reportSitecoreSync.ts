import config from './config';
import {
  createSitecoreSerializationSyncReport,
  isSitecoreSerializationFolder,
} from './services/sitecoreSerialization';

type CliOptions = {
  folderPath: string;
  affix: string;
  templateUid?: string;
  json: boolean;
  mismatchesOnly: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    folderPath: config?.localPath || '',
    affix: 'cs',
    json: false,
    mismatchesOnly: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case '--path':
      case '-p':
        if (next) {
          options.folderPath = next;
          index++;
        }
        break;
      case '--affix':
      case '-a':
        if (next) {
          options.affix = next;
          index++;
        }
        break;
      case '--template':
      case '-t':
        if (next) {
          options.templateUid = next;
          index++;
        }
        break;
      case '--json':
        options.json = true;
        break;
      case '--mismatches-only':
        options.mismatchesOnly = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function printUsage(): void {
  console.log('Usage: npm run report:sitecore-sync -- [options]');
  console.log('');
  console.log('Options:');
  console.log('  --path, -p             Sitecore serialization folder path');
  console.log('  --affix, -a            UID affix to use for report comparison');
  console.log('  --template, -t         Single template UID to report on');
  console.log('  --json                 Print JSON instead of tabular text');
  console.log('  --mismatches-only      Show only templates with count mismatches');
}

function printTable(report: ReturnType<typeof createSitecoreSerializationSyncReport>): void {
  const summary = report.map((item) => ({
    template: item.templateUid,
    groups: `${item.actualGroupCount}/${item.expectedGroupCount}`,
    fields: `${item.actualFieldCount}/${item.expectedFieldCount}`,
    status: item.matches ? 'OK' : 'MISMATCH',
  }));

  console.table(summary);

  const mismatches = report.filter((item) => !item.matches);
  console.log(`Templates checked: ${report.length}`);
  console.log(`Templates matched: ${report.length - mismatches.length}`);
  console.log(`Templates mismatched: ${mismatches.length}`);

  if (mismatches.length) {
    console.log('');
    console.log('Mismatch details:');
    for (const mismatch of mismatches) {
      console.log(`- ${mismatch.templateUid}`);
      for (const section of mismatch.sectionBreakdown) {
        if (section.expectedFieldCount !== section.actualFieldCount) {
          console.log(
            `  section=${section.sectionKey} expected=${section.expectedFieldCount} actual=${section.actualFieldCount}`
          );
        }
      }
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args);

  if (!options.folderPath) {
    console.error('A serialization folder path is required.');
    printUsage();
    process.exit(1);
  }

  if (!isSitecoreSerializationFolder(options.folderPath)) {
    console.error(`Invalid Sitecore serialization folder: ${options.folderPath}`);
    process.exit(1);
  }

  let report = createSitecoreSerializationSyncReport(
    options.folderPath,
    options.affix,
    options.templateUid
  );

  if (options.mismatchesOnly) {
    report = report.filter((item) => !item.matches);
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  printTable(report);
}

main();