import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { bot } from "./bot";

export const lambda = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log(event.queryStringParameters);
  if (
    event.queryStringParameters &&
    event.queryStringParameters.setWebhook != null
  ) {
    if (!process.env.BOT_URL) {
      return respond(500, "missing BOT_URL");
    }
    try {
      await bot.telegram.setWebhook(process.env.BOT_URL);
      return respond(200, "webhook set");
    } catch (err) {
      return respond(500, err.message);
    }
  }

  if (event.body) {
    const request = JSON.parse(event.body);
    await bot.handleUpdate(request);
  }

  return respond(200, "ok");
};

function respond(statusCode: number, result: string) {
  return {
    statusCode,
    body: JSON.stringify({ result }),
    headers: { "content-type": "application/json" },
  };
}
