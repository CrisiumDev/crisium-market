// tessting the Classifieds contract.
// Modified from a test suite licensed under Apache 2.0 to account for different
// project dependencies and to test new behavior.
//
// See https://github.com/HQ20/contracts/blob/master/test/classifieds/Classifieds.test.ts

const { balance, BN, constants, ether, expectEvent, expectRevert, send, time } = require('@openzeppelin/test-helpers');

const Classifieds = artifacts.require('Classifieds');
const ClassifiedsFactory = artifacts.require('ClassifiedsFactory');
const MockERC721 = artifacts.require('MockERC721');
const MockERC721Resale = artifacts.require('MockERC721Resale');
const MockERC20 = artifacts.require('MockERC20');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract('ClassifiedsFactory', (accounts) => {
    const MANAGER_ROLE = web3.utils.soliditySha3('MANAGER_ROLE');

    let snapshot;

    const poster = accounts[1];
    const filler = accounts[2];
    const royaltyReceiver = accounts[3];
    const deployer = accounts[4];
    const manager = accounts[5];

    let factory;
    let erc20token;
    let erc721token;

    const ERC721id = 42;
    const POSTER = 0;
    const ITEM = 1;
    const PRICE = 2;
    const STATUS = 3;

    beforeEach(async () => {
      snapshot = await time.latest();
      erc20token = await MockERC20.new('Name', 'Symbol', '0');
      erc721token = await MockERC721.new('Name', 'Symbol');
      factory = await ClassifiedsFactory.new(erc20token.address, { from:deployer });
      await factory.grantRole(MANAGER_ROLE, manager, { from:deployer });
    });

    context('creation', () => {
      it('createClassifieds reverts for non-manager', async () => {
        await expectRevert(
          factory.createClassifieds(erc721token.address),
          "ClassifiedsFactory: not authorized"
        );

        await expectRevert(
          factory.createClassifieds(erc721token.address, { from:royaltyReceiver }),
          "ClassifiedsFactory: not authorized"
        );
      });

      it('createClassifieds reverts for zero address', async () => {
        await expectRevert(
          factory.createClassifieds(ZERO_ADDRESS, { from:deployer }),
          "ClassifiedsFactory: invalid address"
        );

        await expectRevert(
          factory.createClassifieds(ZERO_ADDRESS, { from:manager }),
          "ClassifiedsFactory: invalid address"
        );
      });

      it('createClassifieds reverts for already created', async () => {
        await factory.createClassifieds(erc721token.address, { from:deployer });

        await expectRevert(
          factory.createClassifieds(erc721token.address, { from:deployer }),
          "ClassifiedsFactory: already created"
        );

        await expectRevert(
          factory.createClassifieds(erc721token.address, { from:manager }),
          "ClassifiedsFactory: already created"
        );
      });

      context('multiple tokens', () => {
        let erc721token_2;
        let erc721token_3;
        let erc721token_4;

        beforeEach(async () => {
          erc721token_2 = await MockERC721.new('Token 2', 'T2');
          erc721token_3 = await MockERC721.new('Token 3', 'T3');
          erc721token_4 = await MockERC721.new('Token 4', 'T4');
        });

        it('createClassifieds behaves as expected', async () => {
          let res = await factory.createClassifieds(erc721token.address, { from:deployer });

          let classifiedsAddress = await factory.classifieds(erc721token.address);

          await expectEvent.inTransaction(res.tx, factory, "ClassifiedCreated", {
            itemToken: erc721token.address,
            currencyToken:  erc20token.address,
            classifieds: classifiedsAddress
          });
        });

        it('createClassifieds creates a contract with expected internal state', async () => {
          await factory.createClassifieds(erc721token.address, { from:deployer });

          let classifiedsAddress = await factory.classifieds(erc721token.address);

          const classifieds = await Classifieds.at(classifiedsAddress);
          assert.equal(await classifieds.currencyToken(), erc20token.address);
          assert.equal(await classifieds.itemToken(), erc721token.address);
        });

        it('createClassifieds can create multiple contracts', async () => {
          const res = [];
          const address = [];
          const itemToken = [
            erc721token,
            erc721token_2,
            erc721token_3,
            erc721token_4
          ];

          res.push(await factory.createClassifieds(erc721token.address, { from:deployer }));
          res.push(await factory.createClassifieds(erc721token_2.address, { from:manager }));
          res.push(await factory.createClassifieds(erc721token_3.address, { from:deployer }));
          res.push(await factory.createClassifieds(erc721token_4.address, { from:manager }));

          address.push(await factory.classifieds(erc721token.address));
          address.push(await factory.classifieds(erc721token_2.address));
          address.push(await factory.classifieds(erc721token_3.address));
          address.push(await factory.classifieds(erc721token_4.address));

          // unique addresses
          for (let i = 0; i < 4; i++) {
            for (let j = i + 1; j < 4; j++) {
              assert.notEqual(address[i], address[j]);
            }
          }

          // events match
          for (let i = 0; i < 4; i++) {
            await expectEvent.inTransaction(res[i].tx, factory, "ClassifiedCreated", {
              itemToken: itemToken[i].address,
              currencyToken:  erc20token.address,
              classifieds: address[i]
            });
          }
        });

        it('createClassifieds can create multiple contracts with expected internal state', async () => {
          const res = [];
          const address = [];
          const itemToken = [
            erc721token,
            erc721token_2,
            erc721token_3,
            erc721token_4
          ];

          res.push(await factory.createClassifieds(erc721token.address, { from:deployer }));
          res.push(await factory.createClassifieds(erc721token_2.address, { from:manager }));
          res.push(await factory.createClassifieds(erc721token_3.address, { from:deployer }));
          res.push(await factory.createClassifieds(erc721token_4.address, { from:manager }));

          address.push(await factory.classifieds(erc721token.address));
          address.push(await factory.classifieds(erc721token_2.address));
          address.push(await factory.classifieds(erc721token_3.address));
          address.push(await factory.classifieds(erc721token_4.address));

          // check classifieds settings
          for (let i = 0; i < 4; i++) {
            const classifieds = await Classifieds.at(address[i]);
            assert.equal(await classifieds.currencyToken(), erc20token.address);
            assert.equal(await classifieds.itemToken(), itemToken[i].address);
          }
        });
      });

      context('created Classifieds functions as expected', () => {
        let classifieds;

        beforeEach(async () => {
          await factory.createClassifieds(erc721token.address, { from:manager });
          classifieds = await Classifieds.at(await factory.classifieds(erc721token.address));
        });

        /**
         * @test {Classifieds#openTrade}
         */
        it('emits an event when opening trades', async () => {
            await erc721token.mint(poster, [ERC721id]);
            await erc721token.approve(classifieds.address, ERC721id, { from: poster });
            expectEvent(
                await classifieds.openTrade(ERC721id, ether('1'), { from: poster }),
                'TradeStatusChange',
                {
                    ad: `0`,
                    status: stringToBytes32('Open'),
                    poster,
                    item: `${ERC721id}`,
                    price: ether('1').toString()
                },
            );
        });

        /**
         * @test {Classifieds#openTrade} and {Classifieds#getTrade}
         */
        it('opens a trade', async () => {
            await erc721token.mint(poster, [ERC721id]);
            await erc721token.approve(classifieds.address, ERC721id, { from: poster });
            const tradeId = (
                await classifieds.openTrade(ERC721id, ether('1'), { from: poster })
            ).logs[0].args.ad;
            const trade = await classifieds.getTrade(tradeId);
            assert.equal(trade[POSTER], poster);
            assert.equal(trade[STATUS], stringToBytes32('Open'));
            assert.equal(trade[ITEM], `${ERC721id}`);
            assert.equal(trade[PRICE], `${ether('1')}`);
        });

        describe('after opening a trade', () => {
            let tradeId;

            beforeEach(async () => {
                await erc721token.mint(poster, [ERC721id]);
                await erc721token.approve(classifieds.address, ERC721id, { from: poster });
                tradeId = (
                    await classifieds.openTrade(ERC721id, ether('1'), { from: poster })
                ).logs[0].args.ad;
            });

            /**
             * @test {Classifieds#executeTrade}
             */
            it('trades can be executed', async () => {
                await erc20token.mint(filler, ether('1'));
                await erc20token.approve(classifieds.address, ether('1'), { from: filler });
                await classifieds.executeTrade(tradeId, { from: filler });
                const trade = await classifieds.getTrade(tradeId);
                assert.equal(trade[POSTER], poster);
                assert.equal(trade[STATUS], stringToBytes32('Executed'));
                assert.equal(trade[ITEM], `${ERC721id}`);
                assert.equal(trade[PRICE], `${ether('1')}`);

                assert.equal(await erc721token.ownerOf(ERC721id), filler);
                assert.equal(await erc20token.balanceOf(poster), `${ether('1')}`);
            });

            /**
             * @test {Classifieds#executeTrade}
             */
            it('emits an event when executing trades', async () => {
                await erc20token.mint(filler, ether('1'));
                await erc20token.approve(classifieds.address, ether('1'), { from: filler });
                expectEvent(
                    await classifieds.executeTrade(tradeId, { from: filler }),
                    'TradeStatusChange',
                    {
                        ad: `0`,
                        status: stringToBytes32('Executed'),
                        poster,
                        item: `${ERC721id}`,
                        price: ether('1').toString()
                    },
                );
            });

            /**
             * @test {Classifieds#cancelTrade}
             */
            it('trades can be cancelled', async () => {
                await classifieds.cancelTrade(tradeId, { from: poster });
                const trade = await classifieds.getTrade(tradeId);
                assert.equal(trade[POSTER], poster);
                assert.equal(trade[STATUS], stringToBytes32('Cancelled'));
                assert.equal(trade[ITEM], `${ERC721id}`);
                assert.equal(trade[PRICE], `${ether('1')}`);
                assert.equal(await erc721token.ownerOf(ERC721id), poster);
            });

            /**
             * @test {Classifieds#cancelTrade}
             */
            it('trades can only be cancelled by their posters', async () => {
                await erc20token.mint(filler, ether('1'));
                await erc20token.approve(classifieds.address, ether('1'), { from: filler });
                await expectRevert(
                    classifieds.cancelTrade(tradeId, { from: filler }),
                    'Trade can be cancelled only by poster.',
                );
            });

            /**
             * @test {Classifieds#cancelTrade}
             */
            it('emits an event when canceling trades', async () => {
                expectEvent(
                    await classifieds.cancelTrade(tradeId, { from: poster }),
                    'TradeStatusChange',
                    {
                        ad: `0`,
                        status: stringToBytes32('Cancelled'),
                        poster,
                        item: `${ERC721id}`,
                        price: ether('1').toString()
                    },
                );
            });

            describe('after closing a trade', () => {
                beforeEach(async () => {
                    await classifieds.cancelTrade(tradeId, { from: poster });
                });

                /**
                 * @test {Classifieds#executeTrade}
                 */
                it('closed trades cannot be executed', async () => {
                    await expectRevert(
                        classifieds.executeTrade(tradeId, { from: poster }),
                        'Trade is not Open.',
                    );
                });

                /**
                 * @test {Classifieds#cancelTrade}
                 */
                it('closed trades cannot be cancelled', async () => {
                    await expectRevert(
                        classifieds.cancelTrade(tradeId, { from: poster }),
                        'Trade is not Open.',
                    );
                });
            });
        });
      });
    });
});

function stringToBytes32(text) {
    return web3.utils.padRight(web3.utils.fromAscii(text), 64);
}

function bytes32ToString(text) {
    return web3.utils.toAscii(text).replace(/\0/g, '');
}
