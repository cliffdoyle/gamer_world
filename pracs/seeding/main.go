package main

import (
	"fmt"
	"math/bits"
	// "slices"
	"sort"
)

type partici struct{
name string
seed int
}
//generateByePos returns the positions that should get byes
//higher seeds are prioritized first
func generateByePos(bracketSize, numParticipants int)[]int{
    byeCount:=bracketSize-numParticipants
    if byeCount<=0{
        return []int{}
    }

    byePositions:=make([]int,0,byeCount)

    for i:=0;i<byeCount;i++{
        byePositions=append(byePositions, i*2)
    }
    return byePositions

}

//returns positions that should have first round matches
func generateMatchPos(bracketSize int , byepos []int)[]int{
positions:=make([]int,0,bracketSize-len(byepos))
fmt.Println(positions)

//add all byeMap positions in a map for easy lookup
byeMap:=make(map[int]bool)

for _,pos:= range byepos{
    byeMap[pos]=true
}

//if not in byeMap add to slice that holds positions that should begin first round
for i:=0;i<bracketSize;i++{
    if !byeMap[i]{
        positions=append(positions, i)
    }
}
return positions
}

func nextPower(n int)int{
    return 1<<(bits.Len(uint(n-1)))
}

//gives byes to the right participants
func challongeSeeding(parti []partici, bracketSize int)[]partici{
    fmt.Println("Participants with seeds",parti)
    res:=make([]partici,bracketSize)
    fmt.Println("our result slice",res)

    //Special handling for very small brackets
    if len(parti)<=2{
        for i:=0;i<len(parti);i++{
            res[i]=parti[i]
        }
        return res
    }
byes:=generateByePos(bracketSize,len(parti))
fmt.Println("byes in challongeseeding",byes)

//place top seeds in bye positions first
seedIndex:=0
for _,pos:=range byes{
    if seedIndex<len(parti){
        res[pos]=parti[seedIndex]
        fmt.Println("res[pos]",res[pos])
        seedIndex++
    }
}

fmt.Println("our slice after adding partiss in byes positions",res)

//Fill remaining positions now
remPos:=generateMatchPos(bracketSize,byes)
fmt.Println("The remaining positions to be filled",remPos)
fmt.Println("The seed index after dealing with byes",seedIndex)
for _,pos:=range remPos{
    if seedIndex<len(parti){
        res[pos]=parti[seedIndex]
        seedIndex++
    }
}
fmt.Println("The final slice after adding remaining positions",res)
return res
}

func main(){
    struct1:=[]partici{
        {name: "cliff",seed: 4},
        {name: "lorna",seed:3},
        {name:"kerry",seed:2},
        {name: "john",seed: 1},
        {name: "jojo",seed: 5},   
    }
    //we need to sort the slice of participants so that those with high seeds come on top
    // slices.SortFunc()
    sort.Slice(struct1,func(i,j int)bool{
        return struct1[i].seed<struct1[j].seed
    })

    fmt.Println("struct1 after sorting with seeds",struct1)

    numPart:=len(struct1)
    bracketSize:=nextPower(numPart)

    byes:=generateByePos(bracketSize,numPart)
    nonbyes:=generateMatchPos(bracketSize,byes)

    fmt.Println(numPart)
    fmt.Println(bracketSize)
    fmt.Println("non byes positions",nonbyes)
    fmt.Println("byes positions",byes)

    fmt.Println("challonge style seeding",challongeSeeding(struct1,bracketSize))


}