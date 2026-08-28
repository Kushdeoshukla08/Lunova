-- /media/[...key] resolves an object key back to its Photo row to authorize the
-- request. That lookup has to be an exact point read, and a key must never map
-- to two photos, so the column becomes unique.
CREATE UNIQUE INDEX "Photo_storageKey_key" ON "Photo"("storageKey");
