/**
 * `ViewTransition` ships in the React canary the App Router runs on, and Next
 * 16.3 needs no configuration flag for it — but `@types/react` keeps its
 * declaration in `react/canary`, which nothing in this workspace pulls in.
 *
 * The reference only has to appear once in the project, and it belongs here
 * rather than in the app's tsconfig: the prototype is the only thing using it,
 * so deleting the prototype deletes the opt-in with it.
 */
/// <reference types="react/canary" />
