package server

import (
	"net/http"
	"strconv"
)

// 资产合集 API。合集是 FOFA 资产同步产生的「显式成员清单」(见 db/collections.go)，
// 可在新建任务时选为测试目标(task_scope kind='collection')。

// GET /api/collections — 列出全部资产合集(新→旧)，各带成员数。
func (s *Server) listCollections(w http.ResponseWriter, r *http.Request) {
	if s.pg(w) == nil {
		return
	}
	cols, err := s.m.pg.ListCollections()
	if err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"collections": cols})
}

// DELETE /api/collections/{id} — 删除合集(级联清理成员与引用它的 task_scope 行)。
func (s *Server) deleteCollection(w http.ResponseWriter, r *http.Request) {
	if s.pg(w) == nil {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeErr(w, 400, "invalid collection id")
		return
	}
	if err := s.m.pg.DeleteCollection(id); err != nil {
		writeErr(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"deleted": true})
}
