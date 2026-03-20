CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`role` varchar(50) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`placeId` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`rating` float,
	`reviewCount` int,
	`category` varchar(255),
	`distance` float,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `googleAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`googleAccountId` varchar(255) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `googleAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `googleAccounts_googleAccountId_unique` UNIQUE(`googleAccountId`)
);
--> statement-breakpoint
CREATE TABLE `keywords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`term` varchar(255) NOT NULL,
	`frequency` int DEFAULT 1,
	`sentiment` varchar(50),
	`source` varchar(50) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keywords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`date` timestamp NOT NULL,
	`views` int DEFAULT 0,
	`searches` int DEFAULT 0,
	`mapViews` int DEFAULT 0,
	`websiteClicks` int DEFAULT 0,
	`phoneCallClicks` int DEFAULT 0,
	`directionRequests` int DEFAULT 0,
	`photoViews` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`googleAccountId` varchar(255) NOT NULL,
	`googleLocationId` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`phone` varchar(20),
	`website` varchar(255),
	`category` varchar(255),
	`description` text,
	`latitude` float DEFAULT 0,
	`longitude` float DEFAULT 0,
	`isVerified` boolean DEFAULT false,
	`photoCount` int DEFAULT 0,
	`postCount` int DEFAULT 0,
	`totalReviews` int DEFAULT 0,
	`avgRating` float DEFAULT 0,
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_googleLocationId_unique` UNIQUE(`googleLocationId`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`googleReviewId` varchar(255) NOT NULL,
	`authorName` varchar(255) NOT NULL,
	`authorPhoto` varchar(255),
	`rating` int NOT NULL,
	`comment` text,
	`reply` text,
	`sentiment` varchar(50),
	`sentimentScore` float,
	`publishedAt` timestamp NOT NULL,
	`repliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_googleReviewId_unique` UNIQUE(`googleReviewId`)
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`total` float NOT NULL,
	`completeness` float NOT NULL,
	`reviewScore` float NOT NULL,
	`engagement` float NOT NULL,
	`consistency` float NOT NULL,
	`mediaScore` float NOT NULL,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`category` varchar(100) NOT NULL,
	`priority` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`impact` float DEFAULT 0,
	`isDone` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suggestions_id` PRIMARY KEY(`id`)
);
