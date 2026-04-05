import chalk from 'chalk';

export interface Logger {
  ok(msg: string): void;
  skip(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  info(msg: string): void;
  section(title: string): void;
  step(n: number, total: number, title: string): void;
  warnings: string[];
  errors: string[];
}

export function createLogger(verbose: boolean, dryRun: boolean): Logger {
  const warnings: string[] = [];
  const errors: string[] = [];

  const prefix = dryRun ? chalk.dim('[DRY] ') : '';

  return {
    warnings,
    errors,

    ok(msg: string) {
      console.log(`${chalk.green('✓')} ${prefix}${msg}`);
    },

    skip(msg: string) {
      if (verbose) {
        console.log(`${chalk.dim('–')} ${chalk.dim(msg)}`);
      }
    },

    warn(msg: string) {
      warnings.push(msg);
      console.log(`${chalk.yellow('⚠')}  ${msg}`);
    },

    error(msg: string) {
      errors.push(msg);
      console.log(`${chalk.red('✗')} ${msg}`);
    },

    info(msg: string) {
      if (verbose) {
        console.log(`${chalk.cyan('·')} ${chalk.dim(msg)}`);
      }
    },

    section(title: string) {
      console.log();
      console.log(chalk.bold.cyan(`── ${title}`));
    },

    step(n: number, total: number, title: string) {
      console.log();
      console.log(chalk.bold(`[${n}/${total}] ${title}`));
    },
  };
}
