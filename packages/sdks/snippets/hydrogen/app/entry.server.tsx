import type {EntryContext} from '@shopify/remix-oxygen';
import {RemixServer} from '@remix-run/react';
import isbot from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    // we need to whitelist Builder's CDN for API calls to work.
    connectSrc: ['https://cdn.builder.io'],
    // we need to whitelist Builder's CDN for image requests to work.
    imgSrc: [
      'https://cdn.builder.io',
      'http://localhost:*',
      'https://fakestoreapi.com',
      'https://cdn.dummyjson.com',
    ],
    // we need to allow 'unsafe-eval' for Builder's SDK to evaluate dynamic bindings.
    scriptSrc: ["'unsafe-eval'", 'http://localhost:*'],
    // we need to allow Builder's visual editor to embed the app in an iframe.
    frameAncestors: ['https://builder.io', 'http://localhost:*'],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <RemixServer context={remixContext} url={request.url} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        // eslint-disable-next-line no-console
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
