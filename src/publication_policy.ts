import { z } from "zod";

export const contentUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceUrl: z.string().url(),
  status: z.enum(["draft", "published"]),
  audience: z.enum(["team", "subscribers"]),
});

export type ContentUpdate = z.infer<typeof contentUpdateSchema>;

export function shouldIndex(update: ContentUpdate): boolean {
  return update.status === "published" && update.audience === "subscribers";
}
