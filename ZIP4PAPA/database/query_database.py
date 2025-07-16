import sqlite3

def query_wallet_database():
    """Query and display information from the wallet database"""
    
    # Connect to the database
    conn = sqlite3.connect('database/wallet_data.db')
    cursor = conn.cursor()
    
    # Get total count
    cursor.execute('SELECT COUNT(*) FROM wallets')
    total_count = cursor.fetchone()[0]
    print(f"Total wallet records: {total_count}")
    
    # Get statistics for each field
    fields = ['rebalance', 'open_order', 'open_position', 'new_balance', 'check_balance']
    
    print("\nField Statistics (count of 1s):")
    print("-" * 40)
    for field in fields:
        cursor.execute(f'SELECT COUNT(*) FROM wallets WHERE {field} = 1')
        count_ones = cursor.fetchone()[0]
        percentage = (count_ones / total_count) * 100
        print(f"{field:15}: {count_ones:3} records ({percentage:5.1f}%)")
    
    # Show some sample records
    print(f"\nSample Records (first 10):")
    print("-" * 80)
    print("wallet_name | rebalance | open_order | open_position | new_balance | check_balance")
    print("-" * 80)
    
    cursor.execute('SELECT * FROM wallets LIMIT 10')
    records = cursor.fetchall()
    for record in records:
        print(f"{record[0]:11} | {record[1]:9} | {record[2]:10} | {record[3]:13} | {record[4]:11} | {record[5]:12}")
    
    # Show some random records
    print(f"\nRandom Records (5 samples):")
    print("-" * 80)
    print("wallet_name | rebalance | open_order | open_position | new_balance | check_balance")
    print("-" * 80)
    
    cursor.execute('SELECT * FROM wallets ORDER BY RANDOM() LIMIT 5')
    random_records = cursor.fetchall()
    for record in random_records:
        print(f"{record[0]:11} | {record[1]:9} | {record[2]:10} | {record[3]:13} | {record[4]:11} | {record[5]:12}")
    
    conn.close()

if __name__ == "__main__":
    query_wallet_database() 