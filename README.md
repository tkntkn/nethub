# nethub

- 利用者のプログラムの標準入出力を WebSocket 通信へと変換することでプログラム間をつなぐ役割を担う
- 利用者は、単純な標準入出力を想定して通信処理を放念することで、プログラムの重要な部分に専念できる
- 利用者は、標準入出力でやりとりするデータの形式として、トピックベースを想定した JSON 形式をワンライナーで扱う必要がある

## 使い方

```bash
npm run nethub -- --help
npm run netport -- --help
```

## 利用例

```bash
# 通信のハブとなるサーバーを起動しておく
npm run nethub

# 受けたデータに行番号を付与してエラー出力する常駐プログラム `cat -n 1>&2` に トピック `testX` を紐づける
npm run netport -- -T testX "cat -n 1>&2"

# トピック `test1` `test2` を `testX` に変換して出力する常駐プログラム `sed -u -e s/(test1|test2)/testX/` に トピック `test1` `test2` `test3` を紐づける
npm run netport -- -T test1 -T test2 -T test3 -O "sed -u -e \"s/\(test1\|test2\)/testX/\""

# トピック `test1` を出力するプログラム
npm run netport -- "echo {\"topic\":\"test1\"}"

# トピック `test2` を出力するプログラム
npm run netport -- "echo {\"topic\":\"test2\"}"

# トピック `test3` を出力するプログラム
npm run netport -- "echo {\"topic\":\"test3\"}"
```
