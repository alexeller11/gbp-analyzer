CREATE TABLE `google_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`googleAccountId` varchar(255) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` timestamp,
	`scope` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`syncType` varchar(100) NOT NULL,
	`status` enum('pending','success','failed') DEFAULT 'pending',
	`message` text,
	`nextSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `synced_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`metricType` varchar(100) NOT NULL,
	`value` int DEFAULT 0,
	`date` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `synced_insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `synced_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`googleReviewId` varchar(255) NOT NULL,
	`authorName` varchar(255),
	`rating` int,
	`reviewText` text,
	`reviewUrl` text,
	`publishTime` timestamp,
	`updateTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `synced_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `synced_reviews_googleReviewId_unique` UNIQUE(`googleReviewId`)
);
