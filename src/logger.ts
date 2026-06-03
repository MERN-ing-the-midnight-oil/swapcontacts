import chalk from 'chalk';
import ora, { Ora } from 'ora';

let currentSpinner: Ora | null = null;

export function logInfo(message: string): void {
  console.log(chalk.blue(message));
}

export function logSuccess(message: string): void {
  console.log(chalk.green(message));
}

export function logError(message: string): void {
  console.log(chalk.red(message));
}

export function logWarn(message: string): void {
  console.log(chalk.yellow(message));
}

export function logRunning(message: string): void {
  console.log(chalk.cyan(message));
}

export function logDone(message: string): void {
  console.log(chalk.green(message));
}

export function startSpinner(text: string): Ora {
  if (currentSpinner) {
    currentSpinner.stop();
  }
  currentSpinner = ora(text).start();
  return currentSpinner;
}

export function stopSpinner(success?: boolean, text?: string): void {
  if (!currentSpinner) return;
  if (success === true) {
    currentSpinner.succeed(text);
  } else if (success === false) {
    currentSpinner.fail(text);
  } else {
    currentSpinner.stop();
  }
  currentSpinner = null;
}

export function logContactResults(found: {
  email: string;
  phone: string;
  facebook: string;
}): void {
  const parts: string[] = [];
  if (found.email) parts.push('✓ Found email');
  if (found.phone) parts.push('✓ Found phone');
  if (found.facebook) parts.push('✓ Found Facebook');

  if (parts.length > 0) {
    logSuccess(`  ${parts.join(', ')}`);
  } else {
    console.log(chalk.gray('  — No contact found'));
  }
}
