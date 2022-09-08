import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "./Classifieds.sol";

contract ClassifiedsFactory is Context, AccessControlEnumerable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");


    event ClassifiedCreated(address indexed itemToken, address indexed currencyToken, address indexed classifieds);

    mapping(address => Classifieds) public classifieds;
    address public currencyToken;

    constructor(address _currencyTokenAddress) {
        currencyToken = _currencyTokenAddress;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(MANAGER_ROLE, _msgSender());
    }

    function createClassifieds(address _itemTokenAddress) external returns (address) {
        require(hasRole(MANAGER_ROLE, _msgSender()), "ClassifiedsFactory: not authorized");
        require(_itemTokenAddress != address(0), "ClassifiedsFactory: invalid address");
        require(address(classifieds[_itemTokenAddress]) == address(0), "ClassifiedsFactory: already created");

        Classifieds c = new Classifieds(_itemTokenAddress, currencyToken);
        classifieds[_itemTokenAddress] = c;
        emit ClassifiedCreated(_itemTokenAddress, currencyToken, address(c));

        return address(c);
    }
}
