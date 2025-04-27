package main

import "fmt"

func main() {
	account:=bankaccount{
		owner: "John Doe",
		balance: 1000,
	}
	fmt.Println("Initial balance:", account.checkbalance())
	account.withdraw(700)
	fmt.Println("Balance after withdrawal:", account.checkbalance())
}

type bankaccount struct{
	owner string
	balance int
}

func (b *bankaccount)withdraw(amount int){
	b.balance-=amount
}

func(b *bankaccount)checkbalance() int{
	return b.balance
}