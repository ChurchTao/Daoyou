CREATE TABLE "wanjiedaoyou_wanderer_book_sales" (
	"window_id" varchar(40) PRIMARY KEY NOT NULL,
	"sales" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wanderer_book_sales_count_check" CHECK ("wanjiedaoyou_wanderer_book_sales"."sales" >= 0)
);
