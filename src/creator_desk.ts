import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError } from "./infrai_gateway.js";
import { answerFromUpdates } from "./knowledge_workflow.js";

const askSchema = z.object({ question: z.string().min(3).max(500) }).strict();

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/ask") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Route not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = askSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await answerFromUpdates(input.question);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof z.ZodError || error instanceof SyntaxError
      ? 400
      : error instanceof InfraiError && error.status < 500
        ? error.status
        : 500;
    const message = error instanceof Error ? error.message : "Request failed";
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: message }));
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log("Creator knowledge desk listening on http://localhost:3000");
});
