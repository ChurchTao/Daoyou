ALTER TABLE "wanjiedaoyou_chat_messages" ALTER COLUMN "sect_id" SET DATA TYPE varchar(64) USING "sect_id"::text;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_chat_red_packets" ALTER COLUMN "sect_id" SET DATA TYPE varchar(64) USING "sect_id"::text;
