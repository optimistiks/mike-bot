import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { bot } from "./bot";

export const lambda = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.body) {
    const request = JSON.parse(event.body);
    await bot.handleUpdate(request);
  }

  const result = {
    statusCode: 200,
    body: JSON.stringify({ result: "ok" }),
    headers: { "content-type": "application/json" },
  };

  return result;
};
