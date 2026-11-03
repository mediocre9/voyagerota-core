declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string;
    SESSION_SECRET: string;
    BASE_URL: string;
    ENVIRONMENT: string;

    DB_PORT: string;
    DB_NAME: string;
    DB_HOST: string;
    DB_USERNAME: string;
    DB_PASSWORD: string;

    MQTT_PORT: string;
    MQTT_ADDRESS: string;
    MQTT_CLIENT: string;
    MQTT_USERNAME: string;
    MQTT_PASSWORD: string;

    BROKER_BASIC_AUTH_CREDENTIALS: string;
    BROKER_BASE_URL: string;
    BREVO_SMTP_API_KEY: string;
    BREVO_SMTP_SENDER_NAME: string;
    BREVO_SMTP_SENDER_EMAIL: string;
    BREVO_SMTP_RECEPIENT_DEV_EMAIL: string;

    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI_DEV?: string;
    GOOGLE_REDIRECT_URI_PROD?: string;
  }
}
