// tessting the Classifieds contract.
// Modified from a test suite licensed under Apache 2.0 to account for different
// project dependencies and to test new behavior.
//
// See https://github.com/HQ20/contracts/blob/master/test/classifieds/Classifieds.test.ts

const { balance, BN, constants, ether, expectEvent, expectRevert, send, time } = require('@openzeppelin/test-helpers');

const Classifieds = artifacts.require('Classifieds');
const MockERC721 = artifacts.require('MockERC721');
const MockERC721Resale = artifacts.require('MockERC721Resale');
const MockERC20 = artifacts.require('MockERC20');

contract('Classifieds', (accounts) => {
    let snapshot;

    const poster = accounts[1];
    const filler = accounts[2];
    const royaltyReceiver = accounts[3];

    let classifieds;
    let erc20token;
    let erc721token;

    const ERC721id = 42;
    const POSTER = 0;
    const ITEM = 1;
    const PRICE = 2;
    const STATUS = 3;

    context('w/o royalties', () => {
        beforeEach(async () => {
            snapshot = await time.latest();
            erc20token = await MockERC20.new('Name', 'Symbol', '0');
            erc721token = await MockERC721.new('Name', 'Symbol');
            classifieds = await Classifieds.new(erc721token.address, erc20token.address);
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

    context('with royalty support', () => {
        beforeEach(async () => {
            snapshot = await time.latest();
            erc20token = await MockERC20.new('Name', 'Symbol', '0');
            erc721token = await MockERC721Resale.new('Name', 'Symbol');
            classifieds = await Classifieds.new(erc721token.address, erc20token.address);
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

    context('with royalty set', () => {
        beforeEach(async () => {
            snapshot = await time.latest();
            erc20token = await MockERC20.new('Name', 'Symbol', '0');
            erc721token = await MockERC721Resale.new('Name', 'Symbol');
            await erc721token.setRoyalty(royaltyReceiver, 700);  // 7%
            classifieds = await Classifieds.new(erc721token.address, erc20token.address);
        });

        /**
         * @test {Classifieds#getSaleRoyalty}
         */
        it('getSaleRoyalty reports correct output', async () => {
            await erc721token.mint(poster, [ERC721id]);
            const { amountRoyalty, amountToSeller } = await classifieds.getSaleRoyalty(ERC721id, '1000');
            assert.equal(amountRoyalty, '70');
            assert.equal(amountToSeller, '930');
        });

        /**
         * @test {Classifieds#getSaleRoyalty}
         */
        it('getSaleRoyalty reports correct output across multiple prices', async () => {
            await erc721token.mint(poster, [ERC721id]);
            let res;

            res = await classifieds.getSaleRoyalty(ERC721id, '100');
            assert.equal(res.amountRoyalty, '7');
            assert.equal(res.amountToSeller, '93');

            res = await classifieds.getSaleRoyalty(ERC721id, '900');
            assert.equal(res.amountRoyalty, '63');
            assert.equal(res.amountToSeller, '837');

            res = await classifieds.getSaleRoyalty(ERC721id, '1777');
            assert.equal(res.amountRoyalty, '124');
            assert.equal(res.amountToSeller, '1653');

            await erc721token.setRoyalty(royaltyReceiver, '1234');

            res = await classifieds.getSaleRoyalty(ERC721id, '1777');
            assert.equal(res.amountRoyalty, '219');
            assert.equal(res.amountToSeller, '1558');

            res = await classifieds.getSaleRoyalty(ERC721id, '1000000000');
            assert.equal(res.amountRoyalty, '123400000');
            assert.equal(res.amountToSeller, '876600000');
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
                assert.equal(await erc20token.balanceOf(royaltyReceiver), `${ether('0.07')}`);
                assert.equal(await erc20token.balanceOf(poster), `${ether('0.93')}`);
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

function stringToBytes32(text) {
    return web3.utils.padRight(web3.utils.fromAscii(text), 64);
}

function bytes32ToString(text) {
    return web3.utils.toAscii(text).replace(/\0/g, '');
}
