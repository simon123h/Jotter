package app

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"jotter/backend/internal/config"
)

type AppConfig struct {
	Port            int
	Host            string
	DataDir         string
	DBPath          string
	LogLevel        string
	AutoOpenBrowser bool
	Addr            string
	APIAddr         string
}

func LoadConfig() *AppConfig {
	configFlag := flag.String("config", "", "Path to YAML/JSON configuration file")
	portFlag := flag.Int("port", 0, "Port to run the server on")
	hostFlag := flag.String("host", "", "Host address to bind to")
	dataDirFlag := flag.String("data-dir", "", "Directory to store markdown tasks")
	noBrowserFlag := flag.Bool("no-browser", false, "Do not open the web browser automatically")
	logLevelFlag := flag.String("log-level", "", "Set the logging level")

	flag.Parse()

	cfg := config.GetConfig(*configFlag)

	port := *portFlag
	if port == 0 {
		port = cfg.Port
	}
	if port == 0 {
		port = 8000
	}

	host := *hostFlag
	if host == "" {
		host = cfg.Host
	}
	if host == "" {
		host = "127.0.0.1"
	}

	dataDir := config.GetDataDir(*configFlag, *dataDirFlag)
	dbPath := config.GetDBPath(*configFlag, *dataDirFlag)
	logLevel := config.GetLogLevel(*configFlag)
	if *logLevelFlag != "" {
		logLevel = strings.ToUpper(*logLevelFlag)
	}

	os.Setenv("JOTTER_DATA_DIR", dataDir)
	os.Setenv("JOTTER_LOG_LEVEL", logLevel)

	addr := fmt.Sprintf("%s:%d", host, port)
	apiAddr := fmt.Sprintf("http://%s:%d", host, port)
	if host == "0.0.0.0" {
		apiAddr = fmt.Sprintf("http://localhost:%d", port)
	}

	autoOpen := true
	if *noBrowserFlag {
		autoOpen = false
	} else {
		if fi, err := os.Stdin.Stat(); err == nil {
			if (fi.Mode() & os.ModeCharDevice) == 0 {
				autoOpen = false
			}
		}
	}

	return &AppConfig{
		Port:            port,
		Host:            host,
		DataDir:         dataDir,
		DBPath:          dbPath,
		LogLevel:        logLevel,
		AutoOpenBrowser: autoOpen,
		Addr:            addr,
		APIAddr:         apiAddr,
	}
}
