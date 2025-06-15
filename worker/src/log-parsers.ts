// Parsers for different log formats
export const logParsers = [
    {
        // Apache access log
        name: "apache",
        regex: /^(?<ip>\S+) \S+ \S+ \[(?<timestamp>[^\]]+)\] "(?<method>\S+) (?<url>\S+) (?<protocol>\S+)" (?<status>\d+) (?<size>\d+)/,
        map: (match: any) => ({
            timestamp: match.groups.timestamp,
            service: "apache",
            level: "info",
            message: `${match.groups.method} ${match.groups.url} ${match.groups.status}`
        })
    },
    {
        // Linux syslog
        name: "syslog",
        regex: /^(?<timestamp>\w+ +\d+ +\d+:\d+:\d+) (?<host>\S+) (?<service>\S+): (?<message>.+)/,
        map: (match: any) => ({
            timestamp: match.groups.timestamp,
            service: match.groups.service,
            level: "info",
            message: match.groups.message
        })
    },
    {
        // Nginx access log
        name: "nginx",
        regex: /^(?<ip>\S+) - (?<user>\S+) \[(?<timestamp>[^\]]+)\] "(?<method>\S+) (?<url>\S+) (?<protocol>\S+)" (?<status>\d+) (?<size>\d+)/,
        map: (match: any) => ({
            timestamp: match.groups.timestamp,
            service: "nginx",
            level: "info",
            message: `${match.groups.method} ${match.groups.url} ${match.groups.status}`
        })
    },
    {
        // Docker JSON log
        name: "docker-json",
        regex: /^{.*"log":.*}$/,
        map: (match: any) => {
            try {
                const obj = JSON.parse(match.input);
                return {
                    timestamp: obj.time || new Date().toISOString(),
                    service: obj.stream || "docker",
                    level: "info",
                    message: obj.log?.trim() || match.input
                };
            } catch {
                return { timestamp: new Date().toISOString(), service: "docker", level: "info", message: match.input };
            }
        }
    },
    {
        // Cloudflare Zero Trust Logpush log
        name: "cloudflare-logpush-zero-trust",
        // Accepts both {"Event":{...}} and flat JSON with RayID, EdgeStartTimestamp, etc.
        regex: /^{.*("Event"\s*:\s*\{.*"RayID"|"RayID"\s*:).*/,
        map: (match: any) => {
            try {
                const obj = JSON.parse(match.input);
                // If wrapped in { Event: {...} }, unwrap
                const event = obj.Event || obj;
                return {
                    timestamp: event.EdgeStartTimestamp
                        ? (typeof event.EdgeStartTimestamp === "number"
                            ? new Date(event.EdgeStartTimestamp / 1e6).toISOString() // nanoseconds to ms
                            : new Date(event.EdgeStartTimestamp).toISOString())
                        : new Date().toISOString(),
                    service: event.Host || event.ClientRequestHost || event.ZoneID || "cloudflare-logpush",
                    level: event.WAFAction || event.Outcome || "info",
                    message:
                        event.ClientRequestURI
                            ? `${event.ClientRequestMethod || "GET"} ${event.ClientRequestURI} ${event.EdgeResponseStatus || event.OriginResponseStatus || ""}`.trim()
                            : JSON.stringify(event)
                };
            } catch {
                return { timestamp: new Date().toISOString(), service: "cloudflare-logpush", level: "info", message: match.input };
            }
        }
    },
    {
        // Kubernetes JSON log
        name: "kubernetes-json",
        regex: /^{.*"kubernetes":.*}$/,
        map: (match: any) => {
            try {
                const obj = JSON.parse(match.input);
                return {
                    timestamp: obj.time || new Date().toISOString(),
                    service: obj.kubernetes?.container_name || "kubernetes",
                    level: obj.level || "info",
                    message: obj.log?.trim() || match.input
                };
            } catch {
                return { timestamp: new Date().toISOString(), service: "kubernetes", level: "info", message: match.input };
            }
        }
    },
    {
        // Generic JSON log
        name: "json-generic",
        regex: /^{.*}$/,
        map: (match: any) => {
            try {
                const obj = JSON.parse(match.input);
                return {
                    timestamp: obj.timestamp || obj.time || new Date().toISOString(),
                    service: obj.service || "json",
                    level: obj.level || "info",
                    message: obj.message || match.input
                };
            } catch {
                return { timestamp: new Date().toISOString(), service: "json", level: "info", message: match.input };
            }
        }
    },
    {
        // Key-value log (e.g. foo=bar baz=qux)
        name: "keyvalue",
        regex: /^(\w+=\S+ ?)+$/,
        map: (match: any) => {
            const obj: Record<string, string> = {};
            match.input.split(/ +/).forEach((kv: string) => {
                const [k, v] = kv.split("=");
                if (k && v) obj[k] = v;
            });
            return {
                timestamp: obj.timestamp || new Date().toISOString(),
                service: obj.service || "keyvalue",
                level: obj.level || "info",
                message: obj.message || match.input
            };
        }
    },
    {
        // Windows Event Log
        name: "windows-eventlog",
        regex: /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2} (AM|PM)\s+\w+\s+\w+\s+-\s+(?<message>.+)$/,
        map: (match: any) => ({
            timestamp: new Date().toISOString(),
            service: "windows-eventlog",
            level: "info",
            message: match.groups.message
        })
    },
    {
        // PostgreSQL log
        name: "postgresql",
        regex: /^(?<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+ [A-Z]+) \[(?<pid>\d+)\] (?<level>\w+):  (?<message>.+)$/,
        map: (match: any) => ({
            timestamp: match.groups.timestamp,
            service: "postgresql",
            level: match.groups.level.toLowerCase(),
            message: match.groups.message
        })
    },
    {
        // MySQL log
        name: "mysql",
        regex: /^(?<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+\d+\s+\[(?<level>\w+)\]\s+(?<message>.+)$/,
        map: (match: any) => ({
            timestamp: match.groups.timestamp,
            service: "mysql",
            level: match.groups.level.toLowerCase(),
            message: match.groups.message
        })
    },
    {
        // AWS CloudWatch log
        name: "aws-cloudwatch",
        regex: /^{.*"logStream":.*}$/,
        map: (match: any) => {
            try {
                const obj = JSON.parse(match.input);
                return {
                    timestamp: obj.timestamp || new Date().toISOString(),
                    service: obj.logStream || "aws-cloudwatch",
                    level: obj.level || "info",
                    message: obj.message || match.input
                };
            } catch {
                return { timestamp: new Date().toISOString(), service: "aws-cloudwatch", level: "info", message: match.input };
            }
        }
    },
    {
        // pfSense log
        name: "pfsense",
        regex: /^(?<timestamp>\w+ +\d+ +\d+:\d+:\d+) pfSense\[(?<pid>\d+)\]: (?<message>.+)$/,
        map: (match: any) => ({
            timestamp: match.groups.timestamp,
            service: "pfsense",
            level: "info",
            message: match.groups.message
        })
    },
];

export function parseLogLine(line: string) {
    for (const parser of logParsers) {
        const match = line.match(parser.regex);
        if (match && (match.groups || parser.name === "cloudflare-logpush-zero-trust")) {
            return parser.map(match);
        }
    }
    // Fallback: Unknown format with keyword-based severity detection ONLY if no explicit level is present
    // If the line already contains a recognizable level (e.g. "level=error" or JSON with level), do not override
    // Otherwise, use keyword-based detection
    let level = "info";
    // Try to detect explicit level in key=value pairs
    const explicitLevelMatch = line.match(/\blevel\s*[=:]?\s*(error|warn|warning|info|debug|fatal|critical|panic)\b/i);
    if (explicitLevelMatch && explicitLevelMatch[1]) {
        level = explicitLevelMatch[1].toLowerCase();
    } else {
        const lower = line.toLowerCase();
        if (/(fatal|fail|failed|failure|error|critical|panic)/.test(lower)) {
            level = "error";
        } else if (/(warn|warning)/.test(lower)) {
            level = "warning";
        }
    }
    return { timestamp: new Date().toISOString(), service: "unknown", level, message: line };
}
