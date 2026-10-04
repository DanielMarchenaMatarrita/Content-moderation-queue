-- CreateIndex
CREATE UNIQUE INDEX "ProcessingAttempt_orderId_attemptNumber_key" ON "ProcessingAttempt"("orderId", "attemptNumber");
