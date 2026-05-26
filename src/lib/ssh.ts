import { Client } from 'ssh2';
import * as fs from 'fs';

export async function executeSshCommand(host: string, command: string, timeoutMs: number = 15000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const keyUser = process.env.SSH_USER_KEY || 'deshanr';
  const keyPath = process.env.SSH_KEY_PATH || '';
  const pwdUser = process.env.SSH_USER_PWD || 'root';
  const pwd = process.env.SSH_PASSWORD || '';
  const port = parseInt(process.env.SSH_PORT || '22', 10);

  const tryConnect = (config: any): Promise<{ stdout: string; stderr: string; code: number | null }> => {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;

      const finish = (code: number | null) => {
        if (timeoutId) clearTimeout(timeoutId);
        conn.end();
        resolve({ stdout, stderr, code });
      };

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          if (timeoutMs > 0) {
            timeoutId = setTimeout(() => {
              stderr += `\n\n[ERROR: Command timed out after ${timeoutMs/1000} seconds. Interactive commands like 'sudo -s' are not supported.]`;
              finish(null);
            }, timeoutMs);
          }

          stream.on('close', (code: any, signal: any) => {
            finish(code);
          }).on('data', (data: any) => {
            stdout += data.toString();
          }).stderr.on('data', (data: any) => {
            stderr += data.toString();
          });
        });
      });

      conn.on('error', (err: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        conn.end();
        reject(err);
      });

      try {
        conn.connect(config);
      } catch (err) {
        reject(err);
      }
    });
  };

  let lastError: any;

  // Try Key-based Auth
  if (keyPath && fs.existsSync(keyPath)) {
    try {
      return await tryConnect({
        host,
        port,
        username: keyUser,
        privateKey: fs.readFileSync(keyPath),
        readyTimeout: 10000,
      });
    } catch (err) {
      console.warn(`Key auth failed for ${host}:`, err);
      lastError = err;
    }
  }

  // Fallback to Password Auth
  if (pwd) {
    try {
      return await tryConnect({
        host,
        port,
        username: pwdUser,
        password: pwd,
        readyTimeout: 10000,
      });
    } catch (err) {
      console.warn(`Password auth failed for ${host}:`, err);
      lastError = err;
    }
  }

  if (!lastError) {
    throw new Error("No SSH credentials configured.");
  }

  throw lastError;
}

export async function executeSshCommandStream(
  host: string,
  command: string,
  onData: (data: string, isError: boolean) => void
): Promise<{ code: number | null }> {
  const keyUser = process.env.SSH_USER_KEY || 'deshanr';
  const keyPath = process.env.SSH_KEY_PATH || '';
  const pwdUser = process.env.SSH_USER_PWD || 'root';
  const pwd = process.env.SSH_PASSWORD || '';
  const port = parseInt(process.env.SSH_PORT || '22', 10);

  const tryConnect = (config: any): Promise<{ code: number | null }> => {
    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          stream.on('close', (code: any, signal: any) => {
            conn.end();
            resolve({ code });
          }).on('data', (data: any) => {
            onData(data.toString(), false);
          }).stderr.on('data', (data: any) => {
            onData(data.toString(), true);
          });
        });
      });

      conn.on('error', (err: any) => {
        conn.end();
        reject(err);
      });

      try {
        conn.connect(config);
      } catch (err) {
        reject(err);
      }
    });
  };

  let lastError: any;

  if (keyPath && fs.existsSync(keyPath)) {
    try {
      return await tryConnect({
        host,
        port,
        username: keyUser,
        privateKey: fs.readFileSync(keyPath),
        readyTimeout: 10000,
      });
    } catch (err) {
      console.warn(`Key auth failed for ${host}:`, err);
      lastError = err;
    }
  }

  if (pwd) {
    try {
      return await tryConnect({
        host,
        port,
        username: pwdUser,
        password: pwd,
        readyTimeout: 10000,
      });
    } catch (err) {
      console.warn(`Password auth failed for ${host}:`, err);
      lastError = err;
    }
  }

  if (!lastError) {
    throw new Error("No SSH credentials configured.");
  }

  throw lastError;
}

export async function executeTillSshCommand(host: string, command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const keyUser = process.env.SSH_USER_KEY || 'deshanr';
  const keyPath = process.env.SSH_KEY_PATH || '';

  const oldTillUser = 'root';
  const oldTillKeyPath = process.env.SSH_KEY_PATH_TILL_OLD || '';

  const port = parseInt(process.env.SSH_PORT || '22', 10);

  const tryConnect = (config: any): Promise<{ stdout: string; stderr: string; code: number | null }> => {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let stdout = '';
      let stderr = '';

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          stream.on('close', (code: any, signal: any) => {
            conn.end();
            resolve({ stdout, stderr, code });
          }).on('data', (data: any) => {
            stdout += data.toString();
          }).stderr.on('data', (data: any) => {
            stderr += data.toString();
          });
        });
      });

      conn.on('error', (err: any) => {
        conn.end();
        reject(err);
      });

      try {
        conn.connect(config);
      } catch (err) {
        reject(err);
      }
    });
  };

  let lastError: any;

  // Try New Till Auth (deshanr)
  if (keyPath && fs.existsSync(keyPath)) {
    try {
      return await tryConnect({
        host,
        port,
        username: keyUser,
        privateKey: fs.readFileSync(keyPath),
        readyTimeout: 10000,
      });
    } catch (err) {
      console.warn(`New till key auth failed for ${host}:`, err);
      lastError = err;
    }
  }

  // Fallback to Old Till Auth (root + root-rsa-till)
  if (oldTillKeyPath && fs.existsSync(oldTillKeyPath)) {
    try {
      return await tryConnect({
        host,
        port,
        username: oldTillUser,
        privateKey: fs.readFileSync(oldTillKeyPath),
        readyTimeout: 10000,
      });
    } catch (err) {
      console.warn(`Old till key auth failed for ${host}:`, err);
      lastError = err;
    }
  }

  if (!lastError) {
    throw new Error("No Till SSH credentials configured.");
  }

  throw lastError;
}
