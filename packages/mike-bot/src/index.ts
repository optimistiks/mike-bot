import express from "express";

const app = express();

const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  return;
});

app.listen(port, () => {
  console.log(
    `Example app listening at http://localhost:${port}`,
    process.env.TEST
  );
});
