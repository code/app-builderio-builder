import { type Page } from '@playwright/test';
import { EMBEDDER_PORT, GEN1_SDK_LOADED_MSG, GEN2_SDK_LOADED_MSG } from './context.js';
import type { BuilderContent, EditType } from '../specs/types.js';
import type { Sdk } from './sdk.js';
import type { Path } from '../specs/index.js';
import { PAGES } from '../specs/index.js';

const EMBEDDED_SERVER_URL = `http://localhost:${EMBEDDER_PORT}`;
const getEmbeddedServerURL = (path: string, port: number) =>
  EMBEDDED_SERVER_URL + path + '?port=' + port;

export const launchEmbedderAndWaitForSdk = async ({
  page,
  basePort,
  path,
  gotoOptions,
  sdk,
}: {
  page: Page;
  basePort: number;
  path: Path;
  gotoOptions?: Parameters<Page['goto']>[1];
  sdk: Sdk;
}) => {
  if (sdk === 'oldReact') {
    await page.route('https://cdn.builder.io/api/v3/query/**', async route => {
      const newLocal = PAGES[path as keyof typeof PAGES].content;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ page: [newLocal] }),
      });
    });
  }

  const msgPromise = page.waitForEvent(
    'console',
    msg => msg.text().includes(GEN2_SDK_LOADED_MSG) || msg.text().includes(GEN1_SDK_LOADED_MSG)
  );
  await page.goto(getEmbeddedServerURL(path, basePort), gotoOptions);
  await msgPromise;
};

export const sendContentUpdateMessage = async ({
  page,
  newContent,
  model,
}: {
  page: Page;
  newContent: BuilderContent;
  model: string;
  editType?: EditType;
}) => {
  await page.evaluate(
    msgData => {
      const contentWindow = document.querySelector('iframe')?.contentWindow;
      if (!contentWindow) throw new Error('Could not find iframe');

      contentWindow.postMessage(
        {
          type: 'builder.contentUpdate',
          data: {
            key: msgData.model,
            data: {
              id: msgData.id,
              data: msgData.data,
            },
          },
        },
        '*'
      );
    },
    { ...newContent, model }
  );
};

export const sendNewStateMessage = async ({
  page,
  newState,
  model,
  editType,
}: {
  page: Page;
  newState: Record<string, any>;
  model: string;
  editType?: EditType;
}) => {
  await page.evaluate(
    msgData => {
      const contentWindow = document.querySelector('iframe')?.contentWindow;
      if (!contentWindow) throw new Error('Could not find iframe');

      contentWindow.postMessage(
        {
          type: 'builder.resetState',
          data: {
            state: msgData.newState,
            model: msgData.model,
            editType: msgData.editType,
          },
        },
        '*'
      );
    },
    { newState, model, editType }
  );
};

type Patch = {
  op: 'replace' | 'add' | 'remove';
  path: string;
  value: string;
};

export const sendPatchUpdatesMessage = async ({
  page,
  patches,
  id,
}: {
  page: Page;
  patches: Patch[];
  id: string;
}) => {
  await page.evaluate(
    msgData => {
      const contentWindow = document.querySelector('iframe')?.contentWindow;
      if (!contentWindow) throw new Error('Could not find iframe');

      contentWindow.postMessage(
        {
          type: 'builder.patchUpdates',
          data: {
            data: {
              [msgData.id]: msgData.patches,
            },
          },
        },
        '*'
      );
    },
    { patches, id }
  );
};

export const cloneContent = (content: BuilderContent) => JSON.parse(JSON.stringify(content));

export const sendPatchOrUpdateMessage = async ({
  page,
  content,
  model,
  sdk,
  updateFn,
  path,
  editType,
}: {
  page: Page;
  content: BuilderContent;
  model: string;
  sdk: Sdk;
  updateFn: (text: string) => string;
  path: string;
  editType?: EditType;
}) => {
  const pathParts = path.split('/').filter(Boolean);
  let target: any = content;
  for (let i = 0; i < pathParts.length - 1; i++) {
    target = target[pathParts[i]];
  }

  const lastKey = pathParts[pathParts.length - 1];

  const newValue = updateFn(target[lastKey]);

  target[lastKey] = newValue;

  if (sdk === 'oldReact') {
    await sendPatchUpdatesMessage({
      page,
      patches: [{ op: 'replace', path, value: newValue }],
      id: content.id ?? '',
    });
  } else {
    await sendContentUpdateMessage({ page, newContent: content, model, editType });
  }

  return content;
};
