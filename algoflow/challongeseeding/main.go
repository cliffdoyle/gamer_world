package main

import (
	"fmt"
	"math"
	"math/bits"
	"sort"

	"github.com/google/uuid"
)

type partici struct{
	id uuid.UUID
name string
seed int
}

type match struct{
	id uuid.UUID
	round int
	matchNum int
	participant1ID uuid.UUID
	participant2ID uuid.UUID
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
func challongeSeeding(parti []*partici, bracketSize int)[]*partici{
    fmt.Println("Participants with seeds",parti)
    res:=make([]*partici,bracketSize)
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
        seedIndex++
    }
}

fmt.Println("our slice after adding partiss in byes positions",res)

//Fill remaining positions now
remPos:=generateMatchPos(bracketSize,byes)
for _,pos:=range remPos{
    if seedIndex<len(parti){
        res[pos]=parti[seedIndex]
		seedIndex++
    }
}
fmt.Println("our slice after adding partiss in match positions",res)
return res
}

func singleElimBracket(parti []*partici)([]*partici,[]*partici){
	if len(parti)<=2{
		return []*partici{},[]*partici{}
	}

	partiCopy:=make([]*partici,len(parti))
	copy(partiCopy,parti)

	//sort our slice by seeds
	sort.Slice(partiCopy,func(i,j int)bool{
		return partiCopy[i].seed<partiCopy[j].seed
	})

	//Calculate rounds
	numPart:=len(partiCopy)
	numRounds:=int(math.Log2(float64(numPart)))
	fmt.Println("number of rounds",numRounds)
	partNextPowerofTwo:=nextPower(numPart)
	fmt.Println("next power of two",partNextPowerofTwo)

	roundMatches:=make([][]*match,numRounds+1)
	matches:=make([]*match,0,numRounds-1)
	matchCounter:=0

	//apply the challonge seeding
	seededParticipants:=challongeSeeding(partiCopy,partNextPowerofTwo)
	fmt.Println("seeded participants:");printParticipants(seededParticipants)

	//first round matches
	// firstRoundMatchCount:=numPart/2
	// fmt.Println("first round match count",firstRoundMatchCount)
	//This is the correct formula for determining the number of byes
	byescount:=partNextPowerofTwo-numPart

	//process the byes participants
	byeParticipants:=make([]*partici,0,byescount)
	for i:=0;i<byescount*2;i+=2{
		if seededParticipants[i] !=nil{
			byeParticipants=append(byeParticipants, seededParticipants[i])

		}
	}
	fmt.Println("participants proceeding through byes:") ;printParticipants(byeParticipants)
	//first round matches for the remaining participants
	remainingParticipants:=make([]*partici,0,numPart)

	for i:=0;i<len(seededParticipants);i++{
		if seededParticipants[i] !=nil && !isInByes(seededParticipants[i],byeParticipants){
			remainingParticipants=append(remainingParticipants, seededParticipants[i])
		}
	}
	fmt.Println("participants beginning first round:") ;printParticipants(remainingParticipants)

	//Creating matches for those who dont have byes
	for i:=0;i<len(remainingParticipants);i+=2{
		match:=match{
			id: uuid.New(),
			round: 1,

		}

		if 2*i<len(remainingParticipants){
			participant1:=remainingParticipants[2*i]
			match.participant1ID=participant1.id
		}
		if 2*i+1<len(remainingParticipants){
			participant2:=remainingParticipants[2*i+1]
			match.participant2ID=participant2.id
		}

		roundMatches[1]=append(roundMatches[1],&match)
		matchCounter++
		matches=append(matches,&match)
	}
	fmt.Println("round 1 matches",roundMatches[1])
	printMatches(matches)


	return byeParticipants,remainingParticipants
}

func isInByes(p *partici,byes []*partici)bool{
	for _,b:=range byes{
		if b==p{
			return true
		}
	}
	return false
}

func printParticipants(p []*partici){
	for _,p:=range p{
		if p !=nil{
			fmt.Printf("Name: %s, seed: %d\n",p.name,p.seed)
		}
	}
}
func printMatches(p []*match){
	for _,p:=range p{
		if p !=nil{
			fmt.Printf("ID1: %v vs ID2: %v\n",p.participant1ID,p.participant2ID)
		}
	}
}

func main(){
    struct1:=[]*partici{
        {name: "cliff",seed: 4,id: uuid.New()},
		{name: "mike",seed: 6,id: uuid.New()},
		{name: "james",seed: 7,id: uuid.New()},
        {name: "lorna",seed:3},
        {name:"kerry",seed:2},
        {name: "john",seed: 1},
        {name: "jojo",seed: 5,id: uuid.New()},   
    }

	res1,res2:=singleElimBracket(struct1)
	fmt.Println("byes proceeding:")
	printParticipants(res1)
	fmt.Println("remaining participants for round 1:")
	printParticipants(res2)
	// //sort our slice by seed
	// sort.Slice(struct1, func(i, j int) bool {
	// 	return struct1[i].seed < struct1[j].seed
	// })
	// fmt.Println("sorted participants",struct1)
    // numPart:=len(struct1)
    // bracketSize:=nextPower(numPart)

    // byes:=generateByePos(bracketSize,numPart)
    // nonbyes:=generateMatchPos(bracketSize,byes)

    // fmt.Println(numPart)
    // fmt.Println(bracketSize)
    // fmt.Println("non byes positions",nonbyes)
    // fmt.Println("byes positions",byes)

    // fmt.Println("challonge style seeding",challongeSeeding(struct1,bracketSize))


}