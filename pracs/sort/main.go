package main

import (
	"fmt"
	"sort"
)


type participant struct{
	seed int
	name string
}

func soti(slice []participant)[]participant{
	sort.Slice(slice, func(i, j int) bool {
		return slice[i].seed>slice[j].seed

	})
	return slice
}

func main(){
	people:=[]participant{
		{2,"elly"},
		{1,"deno"},
		{3,"sammmy"},
	}
	fmt.Println(soti(people))
}

