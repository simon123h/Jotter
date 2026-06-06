package common

import (
	"crypto/rand"
	"math/big"
	"strings"
	"time"
)

const base32Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

func encodeBase32(value int64, length int) string {
	chars := make([]byte, length)
	for i := length - 1; i >= 0; i-- {
		chars[i] = base32Alphabet[value%32]
		value /= 32
	}
	return string(chars)
}

func encodeBase32Big(value *big.Int, length int) string {
	chars := make([]byte, length)
	temp := new(big.Int).Set(value)
	thirtyTwo := big.NewInt(32)
	rem := new(big.Int)

	for i := length - 1; i >= 0; i-- {
		temp.DivMod(temp, thirtyTwo, rem)
		chars[i] = base32Alphabet[rem.Int64()]
	}
	return string(chars)
}

func GenerateULID() string {
	nowMs := time.Now().UnixNano() / int64(time.Millisecond)
	randomBytes := make([]byte, 10)
	_, _ = rand.Read(randomBytes)

	tsStr := encodeBase32(nowMs, 10)

	var randVal big.Int
	randVal.SetBytes(randomBytes)

	randStr := encodeBase32Big(&randVal, 16)
	return tsStr + randStr
}

func Slugify(s string) string {
	s = strings.ToLower(s)
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			sb.WriteRune(r)
		} else if r == ' ' {
			sb.WriteRune('-')
		}
	}
	res := sb.String()
	for strings.Contains(res, "--") {
		res = strings.ReplaceAll(res, "--", "-")
	}
	return strings.Trim(res, "-_")
}
