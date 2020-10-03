declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    GOOGLE_PROJECT_ID?: string;
    GOOGLE_PRIVATE_KEY?: string;
    GOOGLE_CLIENT_EMAIL?: string;
    BOT_URL?: string;
    BOT_KEY?: string;
    BOT_USERNAME?: string;
    LOL_TABLE_NAME?: string;
    CHAT_SESSION_TABLE_NAME?: string;
    APP_ENV?: string;
  }
}
