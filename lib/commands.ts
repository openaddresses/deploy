import cancel from './cancel.js';
import create from './create.js';
import del from './delete.js';
import env from './env.js';
import exec from './exec.js';
import info from './info.js';
import init from './init.js';
import json from './json.js';
import list from './list.js';
import update from './update.js';
import type { CommandModule } from './types.js';

const commands: Record<string, CommandModule> = {
    delete: del,
    create,
    update,
    env,
    list,
    init,
    info,
    json,
    cancel,
    exec
};

export default commands;
