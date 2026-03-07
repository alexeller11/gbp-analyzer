ALTER TABLE `synced_insights` MODIFY COLUMN `value` int NOT NULL;--> statement-breakpoint
ALTER TABLE `synced_insights` MODIFY COLUMN `date` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `synced_reviews` MODIFY COLUMN `rating` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `synced_reviews` MODIFY COLUMN `rating` int NOT NULL;--> statement-breakpoint
ALTER TABLE `synced_reviews` MODIFY COLUMN `publishTime` timestamp NOT NULL;