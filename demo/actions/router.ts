import { action } from 'actionflow';

export interface Navigator {
  push(to: string): unknown;
}

export const routerActions = (router: Navigator) => ({
  'router.push': action(async (params: { to: string }) => {
    await router.push(params.to);
  }),
});
