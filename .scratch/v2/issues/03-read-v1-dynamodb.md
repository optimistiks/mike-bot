# How do we read v1 DynamoDB Marks?

Type: research
Status: claimed

## Question

v1 stores Marks in DynamoDB table `lolTable` (`id`, `createdAt`, `lolType` lol|plus|minus, `fromUser`, `toUser`, `chatId`, `toMessageId`). From Vercel / a one-off script, what are the real options to read that table honestly (IAM keys, export to S3, scan), and what fields are enough to bucket v1 Marks into Seasons?
