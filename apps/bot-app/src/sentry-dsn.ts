function sentryDsn(): string | undefined {
  // eslint-disable-next-line node/no-process-env -- Sentry init reads the DSN from the environment
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export { sentryDsn };
