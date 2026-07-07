// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract LpLockVault {
    struct LockPosition {
        address owner;
        address lpToken;
        uint256 amount;
        uint256 unlockAt;
        uint256 withdrawn;
    }

    uint256 public positionCount;
    mapping(uint256 => LockPosition) public positions;

    event LpLocked(uint256 indexed positionId, address indexed owner, address indexed lpToken, uint256 amount, uint256 unlockAt);
    event LpWithdrawn(uint256 indexed positionId, address indexed owner, uint256 amount);

    function lock(address lpToken, uint256 amount, uint256 unlockAt) external returns (uint256 positionId) {
        require(lpToken != address(0), "LP_REQUIRED");
        require(amount > 0, "AMOUNT_REQUIRED");
        require(unlockAt > block.timestamp, "BAD_UNLOCK");

        bool ok = IERC20Like(lpToken).transferFrom(msg.sender, address(this), amount);
        require(ok, "TRANSFER_FAILED");

        positionId = ++positionCount;
        positions[positionId] = LockPosition({
            owner: msg.sender,
            lpToken: lpToken,
            amount: amount,
            unlockAt: unlockAt,
            withdrawn: 0
        });

        emit LpLocked(positionId, msg.sender, lpToken, amount, unlockAt);
    }

    function withdraw(uint256 positionId) external {
        LockPosition storage position = positions[positionId];
        require(position.owner == msg.sender, "ONLY_OWNER");
        require(block.timestamp >= position.unlockAt, "LOCKED");

        uint256 withdrawable = position.amount - position.withdrawn;
        require(withdrawable > 0, "EMPTY");
        position.withdrawn = position.amount;

        bool ok = IERC20Like(position.lpToken).transfer(msg.sender, withdrawable);
        require(ok, "TRANSFER_FAILED");

        emit LpWithdrawn(positionId, msg.sender, withdrawable);
    }
}
