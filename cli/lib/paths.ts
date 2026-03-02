import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
export const SITL_TOOL = path.resolve(PROJECT_ROOT, 'tools', 'sitl');
export const SITL_SETUP_SCRIPT = path.join(SITL_TOOL, 'scripts', 'setup-ardupilot.sh');
export const SITL_INDEX = path.join(SITL_TOOL, 'src', 'index.ts');
export const ENV_FILE = path.join(PROJECT_ROOT, '.env.local');
export const ENV_EXAMPLE = path.join(PROJECT_ROOT, '.env.example');
export const NODE_MODULES = path.join(PROJECT_ROOT, 'node_modules');
export const SITL_NODE_MODULES = path.join(SITL_TOOL, 'node_modules');
export const ARDUPILOT_DEFAULT = path.join(os.homedir(), '.ardupilot');
export const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');
