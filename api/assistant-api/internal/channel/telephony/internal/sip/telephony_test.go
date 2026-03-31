package internal_sip_telephony

import (
	"testing"

	"github.com/rapidaai/api/assistant-api/config"
	"github.com/rapidaai/protos"
	"google.golang.org/protobuf/types/known/structpb"
)

func vaultCredential(t *testing.T, values map[string]interface{}) *protos.VaultCredential {
	t.Helper()
	v, err := structpb.NewStruct(values)
	if err != nil {
		t.Fatalf("failed to create vault credential: %v", err)
	}
	return &protos.VaultCredential{Value: v}
}

func newSIPTelephonyForTest() *sipTelephony {
	return &sipTelephony{
		appCfg: &config.AssistantConfig{
			SIPConfig: &config.SIPConfig{
				Port:              5060,
				Transport:         "udp",
				RTPPortRangeStart: 10000,
				RTPPortRangeEnd:   10100,
			},
		},
	}
}

func TestParseConfig_UsesPortFromSIPURI(t *testing.T) {
	telephony := newSIPTelephonyForTest()
	cred := vaultCredential(t, map[string]interface{}{
		"sip_uri":      "sip:example.org:5097",
		"sip_username": "user",
		"sip_password": "pass",
	})

	cfg, err := telephony.parseConfig(cred)
	if err != nil {
		t.Fatalf("parseConfig() error = %v", err)
	}

	if cfg.Port != 5097 {
		t.Fatalf("expected parsed SIP URI port 5097, got %d", cfg.Port)
	}
}

func TestParseConfig_UsesExplicitSIPPortFromVault(t *testing.T) {
	telephony := newSIPTelephonyForTest()
	cred := vaultCredential(t, map[string]interface{}{
		"sip_server":   "example.org",
		"sip_port":     5098,
		"sip_username": "user",
		"sip_password": "pass",
	})

	cfg, err := telephony.parseConfig(cred)
	if err != nil {
		t.Fatalf("parseConfig() error = %v", err)
	}

	if cfg.Port != 5098 {
		t.Fatalf("expected explicit vault sip_port 5098, got %d", cfg.Port)
	}
}

func TestParseConfig_DefaultsOutboundTo5090WhenVaultPortMissing(t *testing.T) {
	telephony := newSIPTelephonyForTest()
	cred := vaultCredential(t, map[string]interface{}{
		"sip_server":   "example.org",
		"sip_username": "user",
		"sip_password": "pass",
	})

	cfg, err := telephony.parseConfig(cred)
	if err != nil {
		t.Fatalf("parseConfig() error = %v", err)
	}

	if cfg.Port != 5090 {
		t.Fatalf("expected default outbound SIP port 5090, got %d", cfg.Port)
	}
}
