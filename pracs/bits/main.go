package main

import (
	"fmt"
	"math/bits"
)

func nextPowerTwo(n uint) uint {
	if n <= 1 {
		return 1
	}
	return 1 << (bits.Len(n-1))
}

func main() {
	fmt.Println(nextPowerTwo(17))

}