package common

import (
	"encoding/json"
	"log"
	"net/http"
)

type ErrorResponse struct {
	Detail string `json:"detail"`
}

func SendJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func SendError(w http.ResponseWriter, status int, message string) {
	log.Printf("ERROR: %d - %s", status, message)
	SendJSON(w, status, ErrorResponse{Detail: message})
}

// CORSMiddleware enables CORS for frontend integration
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
