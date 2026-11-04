package db

import "time"

// Collection is a named, explicit-membership set of assets. Unlike a company
// (which groups assets by scope RULE with single global ownership via
// assets.company_id), a collection holds an explicit member list
// (asset_collection_members) and does not affect attribution. Currently produced
// by FOFA asset sync (named by the FOFA query) and usable as a task target via
// task_scope kind='collection'.
type Collection struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Query       string    `json:"query"`
	Source      string    `json:"source"`
	MemberCount int       `json:"member_count"`
	CreatedAt   time.Time `json:"created_at"`
}

// UpsertCollection creates or updates a collection by normalized name (nkey),
// so re-running the same FOFA query merges into the same collection. Returns id.
func (d *DB) UpsertCollection(name, query, source string) (int64, error) {
	if source == "" {
		source = "fofa"
	}
	nkey := companyNKey(name) // same lowercase/trim/collapse normalization
	var id int64
	err := d.QueryRow(`
INSERT INTO asset_collections(name, nkey, query, source)
VALUES ($1, $2, $3, $4)
ON CONFLICT (nkey) DO UPDATE SET
    name = EXCLUDED.name,
    query = EXCLUDED.query,
    updated_at = now()
RETURNING id`, name, nkey, query, source).Scan(&id)
	return id, err
}

// AddCollectionMembers adds assets to a collection (idempotent). Non-existent
// asset ids are silently skipped (the JOIN guards the FK).
func (d *DB) AddCollectionMembers(collectionID int64, assetIDs []int64) error {
	if collectionID <= 0 || len(assetIDs) == 0 {
		return nil
	}
	_, err := d.Exec(`
INSERT INTO asset_collection_members(collection_id, asset_id)
SELECT $1, req.asset_id
FROM unnest($2::bigint[]) AS req(asset_id)
JOIN assets a ON a.id = req.asset_id
ON CONFLICT (collection_id, asset_id) DO NOTHING`, collectionID, assetIDs)
	return err
}

// ListCollections returns all collections newest-first, each with its member count.
func (d *DB) ListCollections() ([]Collection, error) {
	rows, err := d.Query(`
SELECT c.id, c.name, c.query, c.source,
       (SELECT count(*) FROM asset_collection_members m WHERE m.collection_id = c.id),
       c.created_at
FROM asset_collections c
ORDER BY c.created_at DESC, c.id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Collection{}
	for rows.Next() {
		var c Collection
		if err := rows.Scan(&c.ID, &c.Name, &c.Query, &c.Source, &c.MemberCount, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// DeleteCollection removes a collection; its members and any task_scope rows
// referencing it are cascade-deleted.
func (d *DB) DeleteCollection(id int64) error {
	_, err := d.Exec(`DELETE FROM asset_collections WHERE id=$1`, id)
	return err
}
