import {
  ActivatedRouteSnapshot,
  ResolveFn,
  RouterStateSnapshot,
} from '@angular/router';
import { BuilderContent, fetchOneEntry } from '@builder.io/sdk-angular';

export const heroResolver: ResolveFn<BuilderContent | null> = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  return await fetchOneEntry({
    model: 'collection-hero',
    apiKey: 'ee9f13b4981e489a9a1209887695ef2b',
    userAttributes: {
      urlPath: state.url,
    },
  });
};
