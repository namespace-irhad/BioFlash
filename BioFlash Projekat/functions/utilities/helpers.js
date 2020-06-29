exports.toTitleCase = (phrase) => {
    return phrase
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

exports.simplifyData = (data) => {
    return data.replace(/ /g, '').toLowerCase()
}

exports.removeSpecificItem = (array, item) => {
    const index = array.indexOf(item);
    if (index > -1) {
        array.splice(index, 1);
    }
    return array
}